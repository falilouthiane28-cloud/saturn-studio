/**
 * Montage des vidéos motion design de Fatou, sur le serveur : les clips Higgsfield des scènes
 * (dans l'ordre) sont téléchargés, mis au format (720×1280 ou 1280×720), recouverts de leurs
 * titres (PNG fixe avec fondu, ou séquence animée : frappe, mots), collés par ffmpeg, puis
 * sonorisés (sonMotion.ts). Deux fichiers dans /generated-shorts/ : la vidéo finale et sa version
 * muette (pour remixer avec la narration du propriétaire). Sécurité : execFile sans shell, délais,
 * taille maximale par clip, dossier temporaire supprimé, URL https uniquement (rendues par Higgsfield).
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { estRequestId, statutVideo } from "./higgsfieldVideo.ts";
import { FPS_TITRE, dimensions, rendreTitres, type Titre, type TitreRendu } from "./titresMotion.ts";
import { sonoriser, type SceneSon } from "./sonMotion.ts";
import type { FormatVideo } from "../instagram/motion.ts";

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH ?? FFMPEG.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
const TAILLE_MAX = 200 * 1024 * 1024; // 200 Mo par clip
export const DOSSIER_SORTIE = "generated-shorts";

export interface OptionsMontage { format?: FormatVideo; titres?: (TitreRendu | string | null)[] }

const enRendu = (t: TitreRendu | string | null | undefined): TitreRendu | null =>
  !t ? null : typeof t === "string" ? { kind: "image", fichier: t } : t;

/**
 * Arguments ffmpeg : chaque clip mis au format, son titre posé par-dessus (PNG fixe en boucle avec
 * fondu d'entrée, ou séquence animée qui garde sa dernière image), puis concaténation (vidéo seule).
 */
export function argsConcat(entrees: string[], sortie: string, opts: OptionsMontage = {}): string[] {
  if (entrees.length < 2 || entrees.length > 12) throw new Error("Montage : de 2 à 12 clips.");
  const { w, h } = dimensions(opts.format ?? "9:16");
  const titres = entrees.map((_, i) => enRendu(opts.titres?.[i]));
  const entreesTitres: string[] = [];
  const filtres: string[] = [];
  const sorties: string[] = [];
  let k = entrees.length;
  entrees.forEach((_, i) => {
    filtres.push(`[${i}:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},fps=30,setsar=1,format=yuv420p[v${i}]`);
    const t = titres[i];
    if (!t) { sorties.push(`[v${i}]`); return; }
    if (t.kind === "image") {
      entreesTitres.push("-loop", "1", "-framerate", String(FPS_TITRE), "-i", t.fichier);
      filtres.push(`[${k}:v]format=rgba,fade=t=in:st=0.25:d=0.4:alpha=1[t${i}]`);
      filtres.push(`[v${i}][t${i}]overlay=0:0:shortest=1,format=yuv420p[w${i}]`);
    } else {
      entreesTitres.push("-framerate", String(FPS_TITRE), "-i", t.motif);
      filtres.push(`[${k}:v]format=rgba[t${i}]`);
      filtres.push(`[v${i}][t${i}]overlay=0:0:eof_action=repeat,format=yuv420p[w${i}]`);
    }
    sorties.push(`[w${i}]`);
    k++;
  });
  filtres.push(`${sorties.join("")}concat=n=${entrees.length}:v=1:a=0[out]`);
  return [
    "-y", "-hide_banner", "-loglevel", "error",
    ...entrees.flatMap((f) => ["-i", f]),
    ...entreesTitres,
    "-filter_complex", filtres.join(";"),
    "-map", "[out]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart",
    sortie,
  ];
}

/** Colle des fichiers locaux (avec titres éventuels). Renvoie le chemin de sortie. */
export function concatLocal(entrees: string[], sortie: string, opts: OptionsMontage = {}, timeoutMs = 300_000): Promise<string> {
  const args = argsConcat(entrees, sortie, opts);
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, _o, stderr) => {
      if (err) reject(new Error(`ffmpeg a échoué : ${String(stderr || err.message).slice(0, 300)}`));
      else resolve(sortie);
    });
  });
}

/** Durée réelle d'un fichier vidéo (s). */
export function dureeMedia(fichier: string): Promise<number> {
  return new Promise((resolve, reject) => {
    execFile(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", fichier], { timeout: 30_000, windowsHide: true }, (err, out) => {
      const d = Number(String(out).trim());
      if (err || !Number.isFinite(d)) reject(new Error("Durée du clip illisible.")); else resolve(d);
    });
  });
}

async function telecharger(url: string, fichier: string): Promise<void> {
  if (!/^https:\/\//.test(url)) throw new Error("Clip refusé : URL non https.");
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`Téléchargement du clip impossible (${r.status}).`);
  const taille = Number(r.headers.get("content-length") ?? 0);
  if (taille > TAILLE_MAX) throw new Error("Clip trop lourd (200 Mo maximum).");
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > TAILLE_MAX) throw new Error("Clip trop lourd (200 Mo maximum).");
  await fs.writeFile(fichier, buf);
}

export interface ResultatMontage { fichier: string; url: string; url_muette: string; clips: number; duree: number; scenes_son: SceneSon[] }

/**
 * Monte, titre et sonorise des clips locaux (cœur commun au montage serveur et aux tests).
 * `titres` : un par clip (ou vide). `son` : false pour une vidéo muette seulement.
 */
export async function monterLocal(
  fichiers: string[], dossierSortie: string, nom: string, travail: string,
  opts: { format?: FormatVideo; titres?: Titre[]; accent?: string; son?: boolean; types?: SceneSon["type"][] } = {},
): Promise<{ finale: string; muette: string; duree: number; scenes_son: SceneSon[] }> {
  const format = opts.format ?? "9:16";
  const rendus = opts.titres?.length ? await rendreTitres(opts.titres, format, opts.accent ?? "#7C3AED", travail) : [];
  await fs.mkdir(dossierSortie, { recursive: true });
  const muette = path.join(dossierSortie, `${nom}-muet.mp4`);
  await concatLocal(fichiers, muette, { format, titres: rendus });
  // Chronologie réelle (les clips peuvent durer un peu plus que la scène prévue).
  const durees = await Promise.all(fichiers.map(dureeMedia));
  let t = 0;
  const scenes_son: SceneSon[] = durees.map((d, i) => {
    const r = rendus[i];
    const s: SceneSon = { type: opts.types?.[i] ?? opts.titres?.[i]?.type ?? "SOLUTION", debut: t, fin: t + d, aTitre: !!r, frappes: r?.kind === "sequence" ? r.frappes : undefined };
    t += d;
    return s;
  });
  const finale = path.join(dossierSortie, `${nom}.mp4`);
  if (opts.son === false) await fs.copyFile(muette, finale);
  else await sonoriser(muette, scenes_son, t, finale, travail);
  return { finale, muette, duree: t, scenes_son };
}

/**
 * Monte la vidéo finale à partir des request_id des animations de scènes (ordre = ordre des scènes).
 * Chaque job doit être terminé. Titres posés et sound design ajouté. Renvoie les chemins publics.
 */
export async function assemblerMotion(
  requestIds: string[],
  opts: { format?: FormatVideo; titres?: Titre[]; accent?: string; son?: boolean } = {},
  racinePublic = path.join(process.cwd(), "public"),
): Promise<ResultatMontage> {
  if (requestIds.some((id) => !estRequestId(id))) throw new Error("Montage : uniquement des request_id de clips générés par Fatou.");
  const statuts = await Promise.all(requestIds.map((id) => statutVideo(id)));
  const pasPrets = statuts.filter((s) => s.status !== "completed" || !s.videoUrl);
  if (pasPrets.length) throw new Error(`Clips pas encore prêts : ${pasPrets.map((s) => `${s.requestId} (${s.status})`).join(", ")}.`);
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "motion-"));
  try {
    const fichiers = await Promise.all(statuts.map(async (s, i) => {
      const f = path.join(tmp, `scene-${String(i + 1).padStart(2, "0")}.mp4`);
      await telecharger(s.videoUrl!, f);
      return f;
    }));
    const nom = `motion-${Date.now().toString(36)}`;
    const dossier = path.join(racinePublic, DOSSIER_SORTIE);
    const r = await monterLocal(fichiers, dossier, nom, tmp, opts);
    return { fichier: r.finale, url: `/${DOSSIER_SORTIE}/${nom}.mp4`, url_muette: `/${DOSSIER_SORTIE}/${nom}-muet.mp4`, clips: fichiers.length, duree: r.duree, scenes_son: r.scenes_son };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

/**
 * Remixe une vidéo déjà montée avec la narration du propriétaire : on repart de la version muette,
 * on remet le sound design, la nappe et les effets baissent sous la voix. Nouveau fichier final.
 */
export async function remixerAvecNarration(
  urlMuette: string, scenes: SceneSon[], duree: number, narration: string,
  racinePublic = path.join(process.cwd(), "public"),
): Promise<string> {
  const m = /^\/generated-shorts\/(motion-[a-z0-9]+)-muet\.mp4$/.exec(urlMuette);
  if (!m) throw new Error("Vidéo muette introuvable.");
  const muette = path.join(racinePublic, DOSSIER_SORTIE, `${m[1]}-muet.mp4`);
  const nom = `${m[1]}-voix-${Date.now().toString(36)}.mp4`;
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "remix-"));
  try {
    await sonoriser(muette, scenes, duree, path.join(racinePublic, DOSSIER_SORTIE, nom), tmp, narration);
    return `/${DOSSIER_SORTIE}/${nom}`;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
