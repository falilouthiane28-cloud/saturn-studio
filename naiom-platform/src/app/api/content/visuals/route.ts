import { getPost, updatePost } from "@/lib/content/store";
import { composeDirection, directionOf, isSceneDirection, type Direction } from "@/lib/content/directions";
import { advanceScenes, slidesWithScenes, startScenes } from "@/lib/content/sceneRun";

export const runtime = "nodejs";
export const maxDuration = 300;

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
    await startScenes(post, direction);
    return Response.json({ success: true, count: slides.length, direction, scenes: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 500 });
  }
}

/** GET /api/content/visuals?id=... — avance les scènes en cours et renvoie les images. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id requis" }, { status: 400 });
  try {
    const post = await advanceScenes(id);
    if (!post?.visuals) return Response.json({ error: "Aucune génération en cours." }, { status: 404 });
    return Response.json({ images: post.visuals.images, done: post.visuals.done });
  } catch (err) {
    const post = await getPost(id);
    return Response.json({ images: post?.visuals?.images ?? [], done: false, note: err instanceof Error ? err.message : "Erreur" });
  }
}
