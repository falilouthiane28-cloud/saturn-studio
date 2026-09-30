/**
 * Suivi des vidéos motion design générées depuis l'onglet Motion. Le serveur fait avancer
 * chaque vidéo à chaque interrogation : image clé terminée → animation lancée ; toutes les
 * animations terminées → montage ffmpeg → lien final. Rien n'est lancé sans confirmation.
 * Stockage : motion-jobs.json dans le dossier d'état Instagram (50 dernières vidéos).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { animerImage, lancerImageCle, statutVideo } from "../integrations/higgsfieldVideo.ts";
import { assemblerMotion, remixerAvecNarration } from "../integrations/montageMotion.ts";
import { animationPar } from "../integrations/titresMotion.ts";
import type { SceneSon } from "../integrations/sonMotion.ts";
import type { MotionPlan } from "./motionPlan.ts";

export interface EtapeScene { image_id?: string; image_url?: string; video_id?: string; video_url?: string; statut: "attente" | "image" | "animation" | "prete" | "echec"; erreur?: string }
export interface MotionJob {
  id: string;
  createdAt: string;
  plan: MotionPlan;
  statut: "plan" | "generation" | "montage" | "pret" | "echec";
  etapes: EtapeScene[];
  final_url?: string;          // vidéo finale (titres + sound design, + narration si envoyée)
  sans_voix_url?: string;      // version sound design seul (gardée après ajout de la narration)
  url_muette?: string;         // image seule, base des remixages
  duree?: number;
  scenes_son?: SceneSon[];
  narration?: string;          // fichier audio envoyé par le propriétaire (dossier d'état)
  erreur?: string;
}

export const FORMATS_NARRATION: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "aac",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/webm": "webm", "audio/ogg": "ogg",
};
export const TAILLE_MAX_NARRATION = 25 * 1024 * 1024;

const FICHIER = "motion-jobs.json";
const verrous = new Map<string, Promise<unknown>>();

async function lireTous(dossier: string): Promise<MotionJob[]> {
  try { return JSON.parse(await fs.readFile(path.join(dossier, FICHIER), "utf8")); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; }
}
async function ecrireTous(dossier: string, jobs: MotionJob[]) {
  await fs.mkdir(dossier, { recursive: true });
  const f = path.join(dossier, FICHIER);
  await fs.writeFile(`${f}.tmp`, JSON.stringify(jobs.slice(0, 50), null, 1), "utf8");
  await fs.rename(`${f}.tmp`, f);
}

/** Exécute `fn` sur un job, une seule opération à la fois par fichier (pas de double lancement). */
async function avecJob<T>(dossier: string, id: string, fn: (j: MotionJob) => Promise<T>): Promise<{ job: MotionJob; r: T }> {
  const avant = verrous.get(dossier) ?? Promise.resolve();
  let fin!: () => void;
  const suivant = new Promise<void>((res) => { fin = res; });
  verrous.set(dossier, avant.then(() => suivant));
  await avant;
  try {
    const jobs = await lireTous(dossier);
    const job = jobs.find((j) => j.id === id);
    if (!job) throw new Error("Vidéo introuvable.");
    const r = await fn(job);
    await ecrireTous(dossier, jobs);
    return { job, r };
  } finally { fin(); }
}

export async function listerJobs(dossier: string): Promise<MotionJob[]> { return lireTous(dossier); }

export async function creerJob(dossier: string, plan: MotionPlan): Promise<MotionJob> {
  const job: MotionJob = {
    id: `mv-${Date.now().toString(36)}`, createdAt: new Date().toISOString(), plan, statut: "plan",
    etapes: plan.scenes.map(() => ({ statut: "attente" })),
  };
  const jobs = await lireTous(dossier);
  await ecrireTous(dossier, [job, ...jobs]);
  return job;
}

/** Lance les images clés. `confirme` doit venir d'un clic explicite du propriétaire (ça dépense ses crédits). */
export async function lancerJob(dossier: string, id: string, confirme: boolean): Promise<MotionJob> {
  if (confirme !== true) throw new Error("Confirmation requise : la génération dépense tes crédits Higgsfield.");
  return (await avecJob(dossier, id, async (job) => {
    if (job.statut !== "plan" && job.statut !== "echec") return;
    job.statut = "generation"; job.erreur = undefined;
    for (const [i, e] of job.etapes.entries()) {
      if (e.image_id && e.statut !== "echec") continue;
      try { Object.assign(e, { image_id: await lancerImageCle(job.plan.scenes[i].prompt_image, job.plan.format ?? "9:16"), statut: "image", erreur: undefined }); }
      catch (err) { Object.assign(e, { statut: "echec", erreur: (err as Error).message }); job.statut = "echec"; job.erreur = (err as Error).message; break; }
    }
  })).job;
}

/** Fait avancer la vidéo d'un cran (appelé en boucle par l'onglet Motion). */
export async function avancerJob(dossier: string, id: string): Promise<MotionJob> {
  return (await avecJob(dossier, id, async (job) => {
    if (job.statut !== "generation" && job.statut !== "montage") return;
    if (job.statut === "generation") {
      for (const [i, e] of job.etapes.entries()) {
        try {
          if (e.statut === "image" && e.image_id) {
            const s = await statutVideo(e.image_id);
            if (s.status === "failed") throw new Error("image refusée ou en échec chez Higgsfield");
            if (s.status === "completed" && s.imageUrl) {
              const sc = job.plan.scenes[i];
              e.image_url = s.imageUrl;
              e.video_id = await animerImage(s.imageUrl, sc.prompt_animation, Math.min(15, Math.max(2, Math.ceil(sc.fin - sc.debut))));
              e.statut = "animation";
            }
          } else if (e.statut === "animation" && e.video_id) {
            const s = await statutVideo(e.video_id);
            if (s.status === "failed") throw new Error("animation en échec chez Higgsfield");
            if (s.status === "completed" && s.videoUrl) { e.video_url = s.videoUrl; e.statut = "prete"; }
          }
        } catch (err) { Object.assign(e, { statut: "echec", erreur: (err as Error).message }); job.statut = "echec"; job.erreur = `Scène ${i + 1} : ${(err as Error).message}`; return; }
      }
      if (job.etapes.every((e) => e.statut === "prete")) job.statut = "montage";
      else return;
    }
    try {
      // Titres posés au montage : texte à l'écran de chaque scène, mot accentué, logo final.
      const titres = job.plan.scenes.map((s) => ({
        texte: s.texte_ecran, type: s.type, ton: s.ton ?? (s.fond === "black" ? "sombre" as const : "clair" as const),
        animation: animationPar(s.type, job.plan.style ?? "clean-explainer"),
      }));
      const r = await assemblerMotion(job.etapes.map((e) => e.video_id!), { format: job.plan.format ?? "9:16", titres, accent: job.plan.accent });
      Object.assign(job, { final_url: r.url, url_muette: r.url_muette, duree: r.duree, scenes_son: r.scenes_son, statut: "pret" });
    } catch (err) { job.statut = "echec"; job.erreur = `Montage : ${(err as Error).message}`; }
  })).job;
}

/**
 * Narration du propriétaire : fichier audio enregistré dans le dossier d'état, puis la vidéo est
 * remixée (sound design qui baisse sous la voix). La version sans voix reste disponible.
 */
export async function ajouterNarration(dossier: string, id: string, audio: Buffer, typeMime: string): Promise<MotionJob> {
  const ext = FORMATS_NARRATION[typeMime.split(";")[0].trim().toLowerCase()];
  if (!ext) throw new Error("Format audio non accepté (mp3, m4a, aac, wav, webm, ogg).");
  if (!audio.length || audio.length > TAILLE_MAX_NARRATION) throw new Error("Fichier audio vide ou trop lourd (25 Mo maximum).");
  return (await avecJob(dossier, id, async (job) => {
    if (job.statut !== "pret" || !job.url_muette || !job.scenes_son || !job.duree) throw new Error("La vidéo doit être montée avant d'ajouter la narration.");
    const rep = path.join(dossier, "motion-audio");
    await fs.mkdir(rep, { recursive: true });
    const f = path.join(rep, `${job.id}.${ext}`);
    await fs.writeFile(f, audio);
    const url = await remixerAvecNarration(job.url_muette, job.scenes_son, job.duree, f);
    job.sans_voix_url ??= job.final_url;
    job.narration = f;
    job.final_url = url;
  })).job;
}

export async function supprimerJob(dossier: string, id: string): Promise<void> {
  const jobs = await lireTous(dossier);
  await ecrireTous(dossier, jobs.filter((j) => j.id !== id));
}
