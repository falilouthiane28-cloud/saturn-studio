import { generateContent, type Platform, type Format } from "@/lib/content/generate";
import { addPost } from "@/lib/content/store";

export const runtime = "nodejs";
export const maxDuration = 90;

/** POST /api/content/generate { platform, format, idea, template?, refId? } → génère + enregistre. */
export async function POST(req: Request) {
  try {
    const { platform, format, idea, template, refId } = (await req.json()) as {
      platform?: Platform; format?: Format; idea?: string; template?: string; refId?: string;
    };
    if (!platform || !format || !idea?.trim())
      return Response.json({ error: "platform, format et idea requis" }, { status: 400 });

    const result = await generateContent(platform, format, idea.trim(), template);
    const post = await addPost({ platform, format, idea: idea.trim(), template, refId, result });
    return Response.json({ success: true, id: post.id, ...result });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 500 });
  }
}
