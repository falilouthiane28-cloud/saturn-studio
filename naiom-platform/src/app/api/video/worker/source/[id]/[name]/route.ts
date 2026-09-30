import path from "node:path";
import { jobDir, safeName, workerAuthorized } from "@/lib/video/store";
import { fileResponse } from "@/lib/video/files";

export const runtime = "nodejs";

/** GET /api/video/worker/source/<id>/<name> — téléchargement d'un rush par le poste de montage. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; name: string }> }) {
  if (!workerAuthorized(req)) return Response.json({ error: "Jeton du poste de montage invalide" }, { status: 401 });
  const { id, name } = await params;
  try { return fileResponse(req, path.join(jobDir(id), "src", safeName(name))); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 }); }
}
