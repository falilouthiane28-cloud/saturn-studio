import { artDirect, generateContent, type Platform, type Format } from "@/lib/content/generate";
import { addPost } from "@/lib/content/store";
import { directionOf, isSceneDirection, slidesOf } from "@/lib/content/directions";
import { briefForWriter, ninaBrief } from "@/lib/content/nina";

export const runtime = "nodejs";
export const maxDuration = 180;

/** POST /api/content/generate { platform, format, idea, template?, refId? } → génère + enregistre. */
export async function POST(req: Request) {
  try {
    const { platform, format, idea, template, refId } = (await req.json()) as {
      platform?: Platform; format?: Format; idea?: string; template?: string; refId?: string;
    };
    if (!platform || !format || !idea?.trim())
      return Response.json({ error: "platform, format et idea requis" }, { status: 400 });

    // Nina juge le niveau technique ; sur un sujet technique, son brief guide Fatou pour vulgariser.
    const brief = await ninaBrief(idea.trim(), platform);
    const nina = brief?.technical ? brief : undefined;
    const result = await generateContent(platform, format, idea.trim(), template, nina ? briefForWriter(nina) : undefined);
    // Scènes Orbi : Fatou écrit en plus la direction artistique de chaque slide.
    const direction = directionOf(refId);
    const scenes = direction && isSceneDirection(direction)
      ? (await artDirect(slidesOf(result), idea.trim(), direction, nina?.analogies)).map((s) => s.scene ?? "")
      : undefined;
    const post = await addPost({ platform, format, idea: idea.trim(), template, refId, result, scenes, nina });
    return Response.json({ success: true, id: post.id, ...result, nina: nina ? { level: nina.level, audience: nina.audience } : null });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 500 });
  }
}
