import { getPost, updatePost } from "@/lib/content/store";
import { composeDirection, directionOf, slidesOf } from "@/lib/content/directions";

export const runtime = "nodejs";
export const maxDuration = 300;

/** POST /api/content/visuals { id } — rend les slides du post dans sa direction Saturn. */
export async function POST(req: Request) {
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return Response.json({ error: "id requis" }, { status: 400 });
    const post = await getPost(id);
    if (!post) return Response.json({ error: "Post introuvable" }, { status: 404 });
    const slides = slidesOf(post.result);
    if (!slides.length) return Response.json({ error: "Ce post n'a pas de slides à visualiser." }, { status: 400 });
    // Anciens posts (modèles supprimés) : rendus dans la direction par défaut.
    const direction = directionOf(post.refId) ?? "vanguard";
    const images = await composeDirection(id, post.platform, slides, direction);
    await updatePost(id, { visuals: { jobs: [], images, done: true } });
    return Response.json({ success: true, count: images.length, direction });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 500 });
  }
}

/** GET /api/content/visuals?id=... — images rendues du post. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id requis" }, { status: 400 });
  const post = await getPost(id);
  if (!post?.visuals) return Response.json({ error: "Aucune génération en cours." }, { status: 404 });
  return Response.json({ images: post.visuals.images, done: post.visuals.done });
}
