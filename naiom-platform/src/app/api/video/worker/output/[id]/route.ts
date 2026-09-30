import path from "node:path";
import { getJob, jobDir, safeName, workerAuthorized } from "@/lib/video/store";
import { saveBody } from "@/lib/video/files";

export const runtime = "nodejs";
export const maxDuration = 600;

/** PUT /api/video/worker/output/<id>?name=… — dépôt d'un rendu (mp4 ou miniature) par le poste de montage. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!workerAuthorized(req)) return Response.json({ error: "Jeton du poste de montage invalide" }, { status: 401 });
  const { id } = await params;
  if (!(await getJob(id))) return Response.json({ error: "Job introuvable" }, { status: 404 });
  try {
    const name = safeName(new URL(req.url).searchParams.get("name") ?? "");
    if (!/\.(mp4|jpg|jpeg|png)$/i.test(name)) throw new Error("Type de fichier non accepté.");
    const size = await saveBody(req, path.join(jobDir(id), "out", name));
    return Response.json({ success: true, size });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
  }
}
