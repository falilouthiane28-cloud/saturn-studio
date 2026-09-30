import { DOSSIER_ETAT_DEFAUT } from "@/lib/instagram/stateStore";
import { TAILLE_MAX_NARRATION, ajouterNarration } from "@/lib/instagram/motionJobs";

export const runtime = "nodejs";
export const maxDuration = 300;

/** POST /api/motion/jobs/:id/narration (multipart, champ « audio ») → vidéo remixée avec la voix. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (Number(req.headers.get("content-length") ?? 0) > TAILLE_MAX_NARRATION + 1024 * 1024)
      return Response.json({ error: "Fichier audio trop lourd (25 Mo maximum)." }, { status: 413 });
    const form = await req.formData();
    const fichier = form.get("audio");
    if (!(fichier instanceof File)) return Response.json({ error: "Ajoute un fichier audio." }, { status: 400 });
    const job = await ajouterNarration(DOSSIER_ETAT_DEFAUT, id, Buffer.from(await fichier.arrayBuffer()), fichier.type);
    return Response.json({ job });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Erreur" }, { status: 500 });
  }
}
