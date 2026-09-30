import { addJob, deleteJob, getJob, jobDir, updateJob } from "@/lib/video/store";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

/**
 * POST /api/video/jobs/<id>
 *  { action: "submit" }                          → envoi au poste de montage
 *  { action: "feedback", rating, note, variant } → avis sur un rendu
 *  { action: "iterate", note }                   → nouvelle version avec ce retour (mêmes rushs)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) return Response.json({ error: "Montage introuvable" }, { status: 404 });
  const b = (await req.json()) as { action?: string; rating?: number; note?: string; variant?: string };

  if (b.action === "submit") {
    if (!job.clips.length) return Response.json({ error: "Aucun rush envoyé." }, { status: 400 });
    return Response.json({ job: await updateJob(id, { status: "queued", error: undefined }) });
  }
  if (b.action === "feedback") {
    const fb = { rating: Math.min(5, Math.max(1, Math.round(Number(b.rating) || 3))), note: String(b.note ?? "").slice(0, 1000), variant: b.variant, at: new Date().toISOString() };
    return Response.json({ job: await updateJob(id, (j) => ({ feedback: [...(j.feedback ?? []), fb] })) });
  }
  if (b.action === "iterate") {
    const note = String(b.note ?? "").trim().slice(0, 1000);
    if (!note) return Response.json({ error: "Dis ce qu'il faut changer." }, { status: 400 });
    const child = await addJob({ title: job.title, cta: job.cta, style: job.style, formats: job.formats, duration: job.duration, variants: job.variants, assets: job.assets, parentId: job.id, guidance: note, plan: job.plan });
    // Mêmes rushs : copiés dans le nouveau montage.
    const from = path.join(jobDir(job.id), "src");
    await fs.cp(from, path.join(jobDir(child.id), "src"), { recursive: true });
    return Response.json({ job: await updateJob(child.id, { clips: job.clips, status: "queued" }) });
  }
  return Response.json({ error: "Action inconnue" }, { status: 400 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await deleteJob(id);
  return Response.json({ success: true });
}
