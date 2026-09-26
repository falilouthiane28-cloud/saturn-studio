import { promises as fs } from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

/**
 * Sert les médias GÉNÉRÉS après le build (carrousels, images Gemini, miniatures…).
 * En production, Next ne sert que les fichiers de public/ présents au build ;
 * next.config.ts réécrit donc /generated-xxx/… vers cette route.
 */
const DIRS = new Set(["generated-carousels", "generated-images", "generated-shorts", "generated-thumbnails", "content-out"]);
const TYPES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".gif": "image/gif", ".mp4": "video/mp4", ".pdf": "application/pdf", ".zip": "application/zip",
};

export async function GET(_req: Request, ctx: { params: Promise<{ dir: string; file: string[] }> }) {
  const { dir, file } = await ctx.params;
  if (!DIRS.has(dir)) return new Response("Introuvable", { status: 404 });
  const root = path.join(process.cwd(), "public", dir);
  const target = path.resolve(root, ...file);
  if (!target.startsWith(root + path.sep)) return new Response("Introuvable", { status: 404 });
  const type = TYPES[path.extname(target).toLowerCase()];
  if (!type) return new Response("Introuvable", { status: 404 });
  try {
    const data = await fs.readFile(target);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
