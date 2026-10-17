/**
 * Déroulé des Scènes Orbi pour un post : lancement des jobs Higgsfield, file d'attente,
 * contrôle qualité, relance et délai maximal. Les images restent hébergées sur Higgsfield
 * (URLs directes) — aucune écriture filesystem, compatible Vercel serverless.
 */
import { getPost, updatePost, type ContentPost, type SlideJob } from "./store";
import { directionOf, slidesOf, type Direction } from "./directions";
import { checkScene, createSceneJob, pollSceneJob } from "./scenes";
import type { Slide } from "./generate";

const SCENE_TIMEOUT_MS = 25 * 60 * 1000;
const MAX_QC_RETRIES = 2;

export const slidesWithScenes = (post: ContentPost): Slide[] =>
  slidesOf(post.result).map((s, i) => ({ ...s, scene: post.scenes?.[i] ?? s.scene }));

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const isQueueFull = (e: unknown) => /429|queue_full|retryable/i.test(msg(e));
const isNoCredits = (s: string) => /credit/i.test(s);

async function submit(j: SlideJob, d: Direction, post: ContentPost, s: Slide, single: boolean, fix?: string): Promise<void> {
  try {
    j.jobId = await createSceneJob(d, post.platform, s, single, {
      attempt: (j.tries ?? 0) + (j.qc ?? 0),
      fallback: (j.tries ?? 0) > 0,
      fix,
    });
    j.state = "pending";
    j.at = Date.now();
  } catch (e) {
    if (isQueueFull(e)) { j.state = "waiting"; return; }
    j.state = "failed";
    if (isNoCredits(msg(e))) { j.error = "credits"; j.tries = 1; }
  }
}

export async function startScenes(post: ContentPost, d: Direction): Promise<void> {
  const slides = slidesWithScenes(post);
  const single = slides.length === 1;
  const jobs: SlideJob[] = slides.map((_, index) => ({ index, jobId: "", tries: 0, qc: 0, state: "waiting" }));
  await Promise.all(jobs.map((j) => submit(j, d, post, slides[j.index], single)));
  await updatePost(post.id, { visuals: { jobs, images: new Array(slides.length).fill(null), done: false, scenes: new Array(slides.length).fill(null) } });
  await advanceScenes(post.id);
}

export async function advanceScenes(id: string): Promise<ContentPost | null> {
  const post = await getPost(id);
  if (!post?.visuals || post.visuals.done || !post.visuals.jobs.length) return post;
  const direction: Direction = directionOf(post.refId) ?? "vanguard";
  const slides = slidesWithScenes(post);
  const single = slides.length === 1;
  const jobs = post.visuals.jobs.map((j) => ({ ...j }));
  const scenes = [...(post.visuals.scenes ?? new Array(slides.length).fill(null))];
  const images = [...post.visuals.images];

  await Promise.all(jobs.map(async (j) => {
    if (images[j.index]) return;
    const s = slides[j.index];
    if (j.state === "waiting") await submit(j, direction, post, s, single);
    if (j.state === "pending") {
      try {
        const r = await pollSceneJob(j.jobId);
        if (r.state === "done" && r.url) {
          const fix = (j.qc ?? 0) < MAX_QC_RETRIES ? await checkScene(r.url, s.scene) : null;
          if (fix) {
            j.qc = (j.qc ?? 0) + 1;
            j.lastFix = fix;
            scenes[j.index] = r.url;
            await submit(j, direction, post, s, single, fix);
          } else {
            j.state = "done";
            scenes[j.index] = r.url;
            images[j.index] = r.url;
          }
        } else if (r.state === "failed") {
          j.state = "failed";
          if (isNoCredits(r.reason ?? "")) { j.error = "credits"; j.tries = 1; }
        } else if (j.at && Date.now() - j.at > SCENE_TIMEOUT_MS) { j.state = "failed"; j.tries = 1; }
      } catch { /* erreur réseau passagère : on réessaiera au prochain passage */ }
    }
    if (j.state === "failed" && (j.tries ?? 0) < 1) {
      j.tries = 1;
      await submit(j, direction, post, s, single, j.lastFix);
    }
    if (j.state === "failed" && scenes[j.index]) {
      j.state = "done";
      images[j.index] = scenes[j.index];
    }
  }));

  const note = jobs.some((j) => j.error === "credits")
    ? "Crédits Higgsfield épuisés : certaines slides sont sur un fond de repli. Recharge le compte sur higgsfield.ai puis regénère."
    : undefined;
  return updatePost(id, { visuals: { jobs, images, done: images.every((x) => x), scenes, note } });
}
