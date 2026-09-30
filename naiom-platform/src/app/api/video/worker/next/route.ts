import { claimNext, touchWorker, workerAuthorized } from "@/lib/video/store";

export const runtime = "nodejs";

/** GET /api/video/worker/next — le poste de montage signale sa présence et récupère le prochain job. */
export async function GET(req: Request) {
  if (!workerAuthorized(req)) return Response.json({ error: "Jeton du poste de montage invalide" }, { status: 401 });
  await touchWorker();
  const job = await claimNext();
  return Response.json({ job });
}
