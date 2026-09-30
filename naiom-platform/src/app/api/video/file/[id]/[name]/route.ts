import path from "node:path";
import { jobDir, safeName } from "@/lib/video/store";
import { fileResponse } from "@/lib/video/files";

export const runtime = "nodejs";

/** GET /api/video/file/<id>/<name>[?dl=1] — rendu d'un montage (lecture ou téléchargement). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  const { id, name } = await params;
  try {
    const safe = safeName(name);
    const dl = new URL(req.url).searchParams.get("dl") ? `saturn-${id}-${safe}` : undefined;
    return fileResponse(req, path.join(jobDir(id), "out", safe), dl);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
  }
}
