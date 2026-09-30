/**
 * Suivi des vidéos motion design générées depuis l'onglet Motion. Le serveur fait avancer
 * chaque vidéo à chaque interrogation : image clé terminée → animation lancée ; toutes les
 * animations terminées → montage ffmpeg → lien final. Rien n'est lancé sans confirmation.
 * Stockage : motion-jobs.json dans le dossier d'état Instagram (50 dernières vidéos).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { animerImage, lancerImageCle, statutVideo } from "../integrations/higgsfieldVideo.ts";
import { assemblerMotion } from "../integrations/montageMotion.ts";
import type { MotionPlan } from "./motionPlan.ts";

export interface EtapeScene { image_id?: string; image_url?: string; video_id?: string; video_url?: string; statut: "attente" | "image" | "animation" | "prete" | "echec"; erreur?: string }
export interface MotionJob {
  id: string;
  createdAt: string;
  plan: MotionPlan;
  statut: "plan" | "generation" | "montage" | "pret" | "echec";
  etapes: EtapeScene[];
  final_url?: string;
  erreur?: string;
}

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
      try { Object.assign(e, { image_id: await lancerImageCle(job.plan.scenes[i].prompt_image), statut: "image", erreur: undefined }); }
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
      const r = await assemblerMotion(job.etapes.map((e) => e.video_id!));
      job.final_url = r.url; job.statut = "pret";
    } catch (err) { job.statut = "echec"; job.erreur = `Montage : ${(err as Error).message}`; }
  })).job;
}

export async function supprimerJob(dossier: string, id: string): Promise<void> {
  const jobs = await lireTous(dossier);
  await ecrireTous(dossier, jobs.filter((j) => j.id !== id));
}
