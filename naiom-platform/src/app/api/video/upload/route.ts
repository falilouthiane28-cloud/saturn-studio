import path from "node:path";
import { cookies } from "next/headers";
import { authEnabled, SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getJob, jobDir, safeName, updateJob } from "@/lib/video/store";
import { OffsetMismatch, saveChunk, VIDEO_EXT } from "@/lib/video/files";

export const runtime = "nodejs";
export const maxDuration = 900;

/**
 * PUT /api/video/upload?job=…&name=…&offset=…&final=1 — envoi d'un rush par morceaux (corps brut, écrit en flux, reprise possible).
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
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    const final = url.searchParams.get("final") === "1";
    const size = await saveChunk(req, path.join(jobDir(id), "src", name), offset, final);
    if (final) await updateJob(id, (j) => ({ clips: [...j.clips.filter((c) => c.name !== name), { name, size }] }));
    return Response.json({ success: true, name, size });
  } catch (e) {
    if (e instanceof OffsetMismatch) return Response.json({ error: e.message, expected: e.expected }, { status: 409 });
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 });
  }
}
