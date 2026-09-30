import { updateJob, workerAuthorized, type VideoOutput } from "@/lib/video/store";

export const runtime = "nodejs";

/** POST /api/video/worker/done/<id> { outputs, plan } | { error } — fin du rendu. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!workerAuthorized(req)) return Response.json({ error: "Jeton du poste de montage invalide" }, { status: 401 });
  const { id } = await params;
  const b = (await req.json()) as { outputs?: VideoOutput[]; plan?: unknown; error?: string };
  const job = await updateJob(id, b.error
    ? { status: "failed", error: String(b.error).slice(0, 500), doneAt: new Date().toISOString() }
    : { status: "done", outputs: b.outputs ?? [], plan: b.plan, error: undefined, doneAt: new Date().toISOString() });
  return job ? Response.json({ success: true }) : Response.json({ error: "Job introuvable" }, { status: 404 });
}
