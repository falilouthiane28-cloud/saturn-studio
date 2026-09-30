import { DOSSIER_ETAT_DEFAUT } from "@/lib/instagram/stateStore";
import { listerJobs } from "@/lib/instagram/motionJobs";

export const runtime = "nodejs";

/** GET /api/motion/jobs → les vidéos motion design (plus récente d'abord). */
export async function GET() {
  try { return Response.json({ jobs: await listerJobs(DOSSIER_ETAT_DEFAUT) }); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 }); }
}
