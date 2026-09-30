import { DOSSIER_ETAT_DEFAUT } from "@/lib/instagram/stateStore";
import { lireStyles } from "@/lib/instagram/motion";
import { lireTemplates } from "@/lib/instagram/motionTemplates";
import { preparerPlan } from "@/lib/instagram/motionPlan";
import { creerJob } from "@/lib/instagram/motionJobs";

export const runtime = "nodejs";
export const maxDuration = 120;

/** POST /api/motion/plan { idee, templateId } → plan complet (aucun crédit Higgsfield dépensé). */
export async function POST(req: Request) {
  try {
    const { idee, templateId, format } = (await req.json()) as { idee?: string; templateId?: string; format?: "9:16" | "16:9" };
    const [templates, styles] = await Promise.all([lireTemplates(DOSSIER_ETAT_DEFAUT), lireStyles(DOSSIER_ETAT_DEFAUT)]);
    const template = templates.find((t) => t.id === (templateId ?? "explainer-20"));
    if (!template) return Response.json({ error: "Template introuvable." }, { status: 404 });
    const style = styles[template.style] ?? styles["clean-explainer"];
    const plan = await preparerPlan(idee ?? "", template, style, styles[template.style] ? template.style : "clean-explainer", format === "16:9" ? "16:9" : "9:16");
    const job = await creerJob(DOSSIER_ETAT_DEFAUT, plan);
    return Response.json({ job });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 });
  }
}
