/**
 * Déroulé des Scènes Orbi pour un post : lancement des jobs Higgsfield, file d'attente,
 * relance, délai maximal et composition au fil de l'eau. Appelé par la route des visuels
 * (lancement + suivi) et par le téléchargement (pour finir un post dont l'onglet a été fermé).
 */
import { getPost, updatePost, type ContentPost, type SlideJob } from "./store";
import { composeDirection, directionOf, slidesOf, type Direction } from "./directions";
import { createSceneJob, pollSceneJob } from "./scenes";
import type { Slide } from "./generate";

/** Au-delà, une scène toujours en cours est abandonnée au profit du fond de repli. */
const SCENE_TIMEOUT_MS = 10 * 60 * 1000;

export const slidesWithScenes = (post: ContentPost): Slide[] =>
  slidesOf(post.result).map((s, i) => ({ ...s, scene: post.scenes?.[i] ?? s.scene }));

/** Higgsfield limite la file d'attente par compte (20) : ce refus-là est temporaire, pas un échec. */
const isQueueFull = (e: unknown) => /429|queue_full|retryable/i.test(e instanceof Error ? e.message : String(e));

async function submit(j: SlideJob, d: Direction, post: ContentPost, s: Slide, single: boolean, fallback: boolean): Promise<void> {
  try {
    j.jobId = await createSceneJob(d, post.platform, s, single, fallback);
    j.state = "pending";
    j.at = Date.now();
  } catch (e) {
    j.state = isQueueFull(e) ? "waiting" : "failed";
  }
}

/** Lance une scène par slide (celles refusées pour file pleine restent « waiting »). */
export async function startScenes(post: ContentPost, d: Direction): Promise<void> {
  const slides = slidesWithScenes(post);
  const single = slides.length === 1;
  const jobs: SlideJob[] = slides.map((_, index) => ({ index, jobId: "", tries: 0, state: "waiting" }));
  await Promise.all(jobs.map((j) => submit(j, d, post, slides[j.index], single, false)));
  await updatePost(post.id, { visuals: { jobs, images: new Array(slides.length).fill(null), done: false, scenes: new Array(slides.length).fill(null) } });
  await advanceScenes(post.id);
}

/** Fait avancer les scènes : soumet les attentes, relève les jobs, relance un échec, compose les slides prêtes. */
export async function advanceScenes(id: string): Promise<ContentPost | null> {
  const post = await getPost(id);
  if (!post?.visuals || post.visuals.done || !post.visuals.jobs.length) return post;
  const direction: Direction = directionOf(post.refId) ?? "vanguard";
  const slides = slidesWithScenes(post);
  const single = slides.length === 1;
  const jobs = post.visuals.jobs.map((j) => ({ ...j }));
  const scenes = [...(post.visuals.scenes ?? new Array(slides.length).fill(null))];
  const images = [...post.visuals.images];
  const ready: number[] = [];

  for (const j of jobs) {
    if (images[j.index]) continue;
    if (j.state === "waiting") await submit(j, direction, post, slides[j.index], single, (j.tries ?? 0) > 0);
    if (j.state === "pending") {
      try {
        const r = await pollSceneJob(j.jobId, id, j.index);
        if (r.state === "done") { j.state = "done"; scenes[j.index] = r.file ?? null; }
        else if (r.state === "failed") j.state = "failed";
        else if (j.at && Date.now() - j.at > SCENE_TIMEOUT_MS) { j.state = "failed"; j.tries = 1; }
      } catch { /* erreur réseau passagère : on réessaiera au prochain passage */ }
    }
    if (j.state === "failed" && (j.tries ?? 0) < 1) {
      // Une relance, avec une scène plus sobre (un refus vient souvent du contenu de la scène).
      j.tries = 1;
      await submit(j, direction, post, slides[j.index], single, true);
    }
    if (j.state === "done" || (j.state === "failed" && (j.tries ?? 0) >= 1)) ready.push(j.index);
  }

  if (ready.length) {
    const urls = await composeDirection(id, post.platform, slides, direction, { scenes, indices: ready });
    for (const i of ready) images[i] = urls[i] ?? null;
  }
  return updatePost(id, { visuals: { jobs, images, done: images.every((x) => x), scenes } });
}
