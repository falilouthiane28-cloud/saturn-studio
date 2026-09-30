import path from "node:path";
import { cookies } from "next/headers";
import { authEnabled, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getJob, jobDir, safeName, updateJob } from "@/lib/video/store";
import { saveBody, VIDEO_EXT } from "@/lib/video/files";

export const runtime = "nodejs";
export const maxDuration = 900;

/**
 * PUT /api/video/upload?job=…&name=… — envoi d'un rush (corps brut, écrit en flux).
 * Hors du proxy (qui mettrait tout le fichier en mémoire) : la session est vérifiée ici.
 */
export async function PUT(req: Request) {
  if (authEnabled() && !verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value))
    return Response.json({ error: "Authentification requise" }, { status: 401 });
  const url = new URL(req.url);
  const id = url.searchParams.get("job") ?? "";
  const job = await getJob(id);
  if (!job) return Response.json({ error: "Montage introuvable" }, { status: 404 });
  if (job.status !== "uploading") return Response.json({ error: "Ce montage est déjà lancé." }, { status: 409 });
  try {
    const name = safeName(url.searchParams.get("name") ?? "");
    if (!VIDEO_EXT.test(name)) throw new Error("Format vidéo non accepté (mp4, mov, webm, m4v, mkv).");
    const size = await saveBody(req, path.join(jobDir(id), "src", name));
    await updateJob(id, (j) => ({ clips: [...j.clips.filter((c) => c.name !== name), { name, size }] }));
    return Response.json({ success: true, name, size });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
  }
}
