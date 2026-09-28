import { artDirect, generateContent, type Platform, type Format } from "@/lib/content/generate";
import { addPost } from "@/lib/content/store";
import { directionOf, isSceneDirection, slidesOf } from "@/lib/content/directions";

export const runtime = "nodejs";
export const maxDuration = 120;

/** POST /api/content/generate { platform, format, idea, template?, refId? } → génère + enregistre. */
export async function POST(req: Request) {
  try {
    const { platform, format, idea, template, refId } = (await req.json()) as {
      platform?: Platform; format?: Format; idea?: string; template?: string; refId?: string;
    };
    if (!platform || !format || !idea?.trim())
      return Response.json({ error: "platform, format et idea requis" }, { status: 400 });

    const result = await generateContent(platform, format, idea.trim(), template);
    // Scènes Orbi : Léa écrit en plus la direction artistique de chaque slide.
    const direction = directionOf(refId);
    const scenes = direction && isSceneDirection(direction)
      ? (await artDirect(slidesOf(result), idea.trim(), direction)).map((s) => s.scene ?? "")
      : undefined;
    const post = await addPost({ platform, format, idea: idea.trim(), template, refId, result, scenes });
    return Response.json({ success: true, id: post.id, ...result });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 500 });
  }
}
