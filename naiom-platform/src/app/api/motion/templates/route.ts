import { DOSSIER_ETAT_DEFAUT } from "@/lib/instagram/stateStore";
import { lireStyles } from "@/lib/instagram/motion";
import { ajouterTemplate, lireTemplates, supprimerTemplate } from "@/lib/instagram/motionTemplates";
import { proposerTemplate } from "@/lib/instagram/motionPlan";

export const runtime = "nodejs";
export const maxDuration = 60;

/** GET → templates intégrés + perso, et styles disponibles. */
export async function GET() {
  try {
    const [templates, styles] = await Promise.all([lireTemplates(DOSSIER_ETAT_DEFAUT), lireStyles(DOSSIER_ETAT_DEFAUT)]);
    return Response.json({ templates, styles: Object.keys(styles) });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 }); }
}

/** POST { description } → Claude conçoit un template, validé puis enregistré. */
export async function POST(req: Request) {
  try {
    const { description } = (await req.json()) as { description?: string };
    const styles = Object.keys(await lireStyles(DOSSIER_ETAT_DEFAUT));
    const propose = await proposerTemplate(description ?? "", styles);
    const template = await ajouterTemplate(DOSSIER_ETAT_DEFAUT, propose, styles);
    return Response.json({ template });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 }); }
}

/** DELETE ?id= → supprime un template perso (les intégrés restent). */
export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    await supprimerTemplate(DOSSIER_ETAT_DEFAUT, id);
    return Response.json({ ok: true });
  } catch (e) { return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 400 }); }
}
