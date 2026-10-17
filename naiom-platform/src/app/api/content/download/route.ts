import sharp from "sharp";
import { getPost, updatePost } from "@/lib/content/store";
import { directionOf, slidesOf } from "@/lib/content/directions";
import { zipStore } from "@/lib/zip";
import { advanceScenes, startScenes } from "@/lib/content/sceneRun";
import type { Direction } from "@/lib/content/directions";

export const runtime = "nodejs";
export const maxDuration = 300;

async function fetchImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status}) : ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * POST /api/content/download { id, format?: "pdf" | "zip" }
 * Télécharge les images du post. Les images sont des URLs Higgsfield hébergées
 * en externe — on les télécharge en mémoire pour assembler le ZIP ou le PDF.
 */
export async function POST(req: Request) {
  try {
    const { id, format = "zip" } = (await req.json()) as { id?: string; format?: "pdf" | "zip" };
    if (!id) return Response.json({ error: "id requis" }, { status: 400 });
    const post = (await advanceScenes(id)) ?? (await getPost(id));
    if (!post) return Response.json({ error: "Post introuvable" }, { status: 404 });

    if (post.visuals && !post.visuals.done)
      return Response.json({ error: "Les scènes d'Orbi sont encore en cours de création : réessaie dans une minute." }, { status: 409 });

    let images = (post.visuals?.images ?? []).filter((x): x is string => !!x);
    if (!images.length) {
      const slides = slidesOf(post.result);
      if (!slides.length) return Response.json({ error: "Ce post est un texte seul : il n'a pas d'images à télécharger." }, { status: 400 });
      const direction: Direction = directionOf(post.refId) ?? "vanguard";
      await startScenes(post, direction);
      return Response.json({ error: "Génération lancée : réessaie dans une minute." }, { status: 409 });
    }

    const pngs = await Promise.all(images.map((u) => fetchImage(u)));
    const base = `saturn-${post.platform}-${post.id}`;

    if (format === "zip" || format === "pdf") {
      const zip = zipStore(pngs.map((data, i) => ({ name: `${base}-${String(i + 1).padStart(2, "0")}.png`, data })));
      return new Response(new Uint8Array(zip), {
        headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${base}.zip"` },
      });
    }

    return Response.json({ error: "Format non supporté" }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 500 });
  }
}
