/**
 * Déroulé des Scènes Orbi pour un post : lancement des jobs Higgsfield, file d'attente,
 * contrôle qualité, relance, délai maximal et composition au fil de l'eau. Appelé par la
 * route des visuels (lancement + suivi) et par le téléchargement (post dont l'onglet a été fermé).
 */
import { getPost, updatePost, type ContentPost, type SlideJob } from "./store";
import { composeDirection, directionOf, slidesOf, type Direction } from "./directions";
import { checkScene, createSceneJob, pollSceneJob } from "./scenes";
import type { Slide } from "./generate";

/**
 * Au-delà, une scène toujours en cours est abandonnée au profit du fond de repli.
 * Large : quand la file Higgsfield du compte est chargée, une scène peut attendre 15 min et réussir.
 */
const SCENE_TIMEOUT_MS = 25 * 60 * 1000;
/** Nombre de régénérations accordées quand le contrôle qualité rejette une scène. */
const MAX_QC_RETRIES = 2;

export const slidesWithScenes = (post: ContentPost): Slide[] =>
  slidesOf(post.result).map((s, i) => ({ ...s, scene: post.scenes?.[i] ?? s.scene }));

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** Higgsfield limite la file d'attente par compte (20) : ce refus-là est temporaire, pas un échec. */
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

/** Lance une scène par slide (celles refusées pour file pleine restent « waiting »). */
export async function startScenes(post: ContentPost, d: Direction): Promise<void> {
  const slides = slidesWithScenes(post);
  const single = slides.length === 1;
  const jobs: SlideJob[] = slides.map((_, index) => ({ index, jobId: "", tries: 0, qc: 0, state: "waiting" }));
  await Promise.all(jobs.map((j) => submit(j, d, post, slides[j.index], single)));
  await updatePost(post.id, { visuals: { jobs, images: new Array(slides.length).fill(null), done: false, scenes: new Array(slides.length).fill(null) } });
  await advanceScenes(post.id);
}

/** Fait avancer les scènes : soumet les attentes, relève les jobs, contrôle la qualité, relance, compose les slides prêtes. */
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

  await Promise.all(jobs.map(async (j) => {
    if (images[j.index]) return;
    const s = slides[j.index];
    if (j.state === "waiting") await submit(j, direction, post, s, single);
    if (j.state === "pending") {
      try {
        const r = await pollSceneJob(j.jobId, id, j.index);
        if (r.state === "done" && r.file) {
          // Contrôle qualité : une scène ratée (jambes, déformation, texte…) est regénérée avec le correctif.
          const fix = (j.qc ?? 0) < MAX_QC_RETRIES ? await checkScene(r.file, s.scene) : null;
          if (fix) {
            j.qc = (j.qc ?? 0) + 1;
            j.lastFix = fix;
            scenes[j.index] = r.file; // gardée en secours si toutes les tentatives échouent
            await submit(j, direction, post, s, single, fix);
          } else {
            j.state = "done";
            scenes[j.index] = r.file;
          }
        } else if (r.state === "failed") {
          j.state = "failed";
          if (isNoCredits(r.reason ?? "")) { j.error = "credits"; j.tries = 1; }
        } else if (j.at && Date.now() - j.at > SCENE_TIMEOUT_MS) { j.state = "failed"; j.tries = 1; }
      } catch { /* erreur réseau passagère : on réessaiera au prochain passage */ }
    }
    if (j.state === "failed" && (j.tries ?? 0) < 1) {
      // Une relance, avec une scène plus sobre et le modèle suivant de la liste.
      j.tries = 1;
      await submit(j, direction, post, s, single, j.lastFix);
    }
    // Échec définitif après contrôle qualité : on garde la meilleure scène obtenue plutôt que le fond de repli.
    if (j.state === "failed" && scenes[j.index]) j.state = "done";
    if (j.state === "done" || (j.state === "failed" && (j.tries ?? 0) >= 1)) ready.push(j.index);
  }));

  if (ready.length) {
    const urls = await composeDirection(id, post.platform, slides, direction, { scenes, indices: ready });
    for (const i of ready) images[i] = urls[i] ?? null;
  }
  const note = jobs.some((j) => j.error === "credits")
    ? "Crédits Higgsfield épuisés : certaines slides sont sur un fond de repli. Recharge le compte sur higgsfield.ai puis regénère."
    : undefined;
  return updatePost(id, { visuals: { jobs, images, done: images.every((x) => x), scenes, note } });
}
