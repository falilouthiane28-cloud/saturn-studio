import path from "node:path";
import { getJob, jobDir, safeName, workerAuthorized } from "@/lib/video/store";
import { OffsetMismatch, saveChunk } from "@/lib/video/files";

export const runtime = "nodejs";
export const maxDuration = 600;

/** PUT /api/video/worker/output/<id>?name=…&offset=…&final=1 — dépôt d'un rendu par morceaux, par le poste de montage. */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!workerAuthorized(req)) return Response.json({ error: "Jeton du poste de montage invalide" }, { status: 401 });
  const { id } = await params;
  if (!(await getJob(id))) return Response.json({ error: "Job introuvable" }, { status: 404 });
  try {
    const q = new URL(req.url).searchParams;
    const name = safeName(q.get("name") ?? "");
    if (!/\.(mp4|jpg|jpeg|png)$/i.test(name)) throw new Error("Type de fichier non accepté.");
    const size = await saveChunk(req, path.join(jobDir(id), "out", name), Math.max(0, Number(q.get("offset")) || 0), q.get("final") === "1");
    return Response.json({ success: true, size });
  } catch (e) {
    if (e instanceof OffsetMismatch) return Response.json({ error: e.message, expected: e.expected }, { status: 409 });
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
  }
}
