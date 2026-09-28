import { getPost, updatePost, type ContentPost, type SlideJob } from "@/lib/content/store";
import { composeDirection, directionOf, isSceneDirection, slidesOf, type Direction } from "@/lib/content/directions";
import { createSceneJob, pollSceneJob } from "@/lib/content/scenes";
import type { Slide } from "@/lib/content/generate";

export const runtime = "nodejs";
export const maxDuration = 300;

const slidesWithScenes = (post: ContentPost): Slide[] =>
  slidesOf(post.result).map((s, i) => ({ ...s, scene: post.scenes?.[i] ?? s.scene }));

/**
 * POST /api/content/visuals { id } — met en image les slides du post.
 * Directions HTML : rendu immédiat. Scènes Orbi : un job Higgsfield par slide, lancés
 * en parallèle ; le GET assemble chaque slide dès que sa scène est prête.
 */
export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return Response.json({ error: "id requis" }, { status: 400 });
    const post = await getPost(id);
    if (!post) return Response.json({ error: "Post introuvable" }, { status: 404 });
    const slides = slidesWithScenes(post);
    if (!slides.length) return Response.json({ error: "Ce post n'a pas de slides à visualiser." }, { status: 400 });
    // Anciens posts (modèles supprimés) : rendus dans la direction par défaut.
    const direction: Direction = directionOf(post.refId) ?? "vanguard";

    if (!isSceneDirection(direction)) {
      const images = await composeDirection(id, post.platform, slides, direction);
      await updatePost(id, { visuals: { jobs: [], images, done: true } });
      return Response.json({ success: true, count: images.length, direction });
    }

    const single = slides.length === 1;
    const created = await Promise.allSettled(slides.map((s) => createSceneJob(direction, post.platform, s, single)));
    const jobs: SlideJob[] = created.map((r, index) =>
      r.status === "fulfilled" ? { index, jobId: r.value, tries: 0, state: "pending" } : { index, jobId: "", tries: 1, state: "failed" });
    const notes = created.flatMap((r) => (r.status === "rejected" ? [r.reason instanceof Error ? r.reason.message : String(r.reason)] : []));
    await updatePost(id, { visuals: { jobs, images: new Array(slides.length).fill(null), done: false, scenes: new Array(slides.length).fill(null) } });
    // Aucune scène lançable (crédits, clé…) : on termine tout de suite avec les fonds de repli.
    if (jobs.every((j) => j.state === "failed")) await advance(id);
    return Response.json({ success: true, count: slides.length, direction, scenes: true, note: notes[0] });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 500 });
  }
}

/** Fait avancer les scènes en cours : relève les jobs, relance un échec, compose les slides prêtes. */
async function advance(id: string): Promise<ContentPost | null> {
  const post = await getPost(id);
  if (!post?.visuals || post.visuals.done) return post;
  const direction: Direction = directionOf(post.refId) ?? "vanguard";
  const slides = slidesWithScenes(post);
  const single = slides.length === 1;
  const jobs = post.visuals.jobs.map((j) => ({ ...j }));
  const scenes = [...(post.visuals.scenes ?? new Array(slides.length).fill(null))];
  const images = [...post.visuals.images];
  const ready: number[] = [];

  await Promise.all(jobs.map(async (j) => {
    if (images[j.index]) return;
    if (j.state === "pending") {
      try {
        const r = await pollSceneJob(j.jobId, id, j.index);
        if (r.state === "done") { j.state = "done"; scenes[j.index] = r.file ?? null; }
        else if (r.state === "failed") j.state = "failed";
      } catch { /* erreur réseau passagère : on réessaiera au prochain passage */ }
    }
    if (j.state === "failed" && (j.tries ?? 0) < 1) {
      // Une relance, avec une scène plus sobre (le refus vient souvent du contenu de la scène).
      j.tries = (j.tries ?? 0) + 1;
      try { j.jobId = await createSceneJob(direction, post.platform, slides[j.index], single, true); j.state = "pending"; }
      catch { j.state = "failed"; }
    }
    if (j.state === "done" || (j.state === "failed" && (j.tries ?? 0) >= 1)) ready.push(j.index);
  }));

  if (ready.length) {
    const urls = await composeDirection(id, post.platform, slides, direction, { scenes, indices: ready });
    for (const i of ready) images[i] = urls[i] ?? null;
  }
  const done = images.every((x) => x);
  return updatePost(id, { visuals: { jobs, images, done, scenes } });
}

/** GET /api/content/visuals?id=... — avance les scènes en cours et renvoie les images. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id requis" }, { status: 400 });
  try {
    const post = await advance(id);
    if (!post?.visuals) return Response.json({ error: "Aucune génération en cours." }, { status: 404 });
    return Response.json({ images: post.visuals.images, done: post.visuals.done });
  } catch (err) {
    const post = await getPost(id);
    return Response.json({ images: post?.visuals?.images ?? [], done: false, note: err instanceof Error ? err.message : "Erreur" });
  }
}
