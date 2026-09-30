import { DOSSIER_ETAT_DEFAUT } from "@/lib/instagram/stateStore";
import { avancerJob, lancerJob, supprimerJob } from "@/lib/instagram/motionJobs";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/motion/jobs/:id
 *  { action: "lancer", confirme: true } → lance les images clés (dépense des crédits)
 *  { action: "avancer" }                 → fait avancer images → animations → montage
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { action, confirme } = (await req.json()) as { action?: string; confirme?: boolean };
    if (action === "lancer") return Response.json({ job: await lancerJob(DOSSIER_ETAT_DEFAUT, id, confirme === true) });
    if (action === "avancer") return Response.json({ job: await avancerJob(DOSSIER_ETAT_DEFAUT, id) });
    return Response.json({ error: "Action inconnue." }, { status: 400 });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try { const { id } = await ctx.params; await supprimerJob(DOSSIER_ETAT_DEFAUT, id); return Response.json({ ok: true }); }
  catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 }); }
}
