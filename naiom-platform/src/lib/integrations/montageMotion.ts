/**
 * Montage des vidéos motion design de Fatou, sur le serveur : les clips Higgsfield des scènes
 * (dans l'ordre) sont téléchargés puis collés par ffmpeg en un seul MP4 vertical 720×1280,
 * servi par /generated-shorts/. Sécurité : execFile sans shell, délais, taille maximale par
 * clip, dossier temporaire supprimé, URL https uniquement (rendues par Higgsfield).
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { estRequestId, statutVideo } from "./higgsfieldVideo.ts";

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const TAILLE_MAX = 200 * 1024 * 1024; // 200 Mo par clip
export const DOSSIER_SORTIE = "generated-shorts";

/** Arguments ffmpeg : mise au format 720×1280 / 30 i/s de chaque clip, puis concaténation (vidéo seule). */
export function argsConcat(entrees: string[], sortie: string): string[] {
  if (entrees.length < 2 || entrees.length > 12) throw new Error("Montage : de 2 à 12 clips.");
  const norm = entrees.map((_, i) => `[${i}:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=white,fps=30,setsar=1,format=yuv420p[v${i}]`);
  const concat = `${entrees.map((_, i) => `[v${i}]`).join("")}concat=n=${entrees.length}:v=1:a=0[out]`;
  return [
    "-y", "-hide_banner", "-loglevel", "error",
    ...entrees.flatMap((f) => ["-i", f]),
    "-filter_complex", [...norm, concat].join(";"),
    "-map", "[out]", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-movflags", "+faststart",
    sortie,
  ];
}

/** Colle des fichiers locaux. Renvoie le chemin de sortie. */
export function concatLocal(entrees: string[], sortie: string, timeoutMs = 180_000): Promise<string> {
  const args = argsConcat(entrees, sortie);
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, args, { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, _o, stderr) => {
      if (err) reject(new Error(`ffmpeg a échoué : ${String(stderr || err.message).slice(0, 300)}`));
      else resolve(sortie);
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

/**
 * Monte la vidéo finale à partir des request_id des animations de scènes (ordre = ordre des scènes).
 * Chaque job doit être terminé. Renvoie le chemin public (/generated-shorts/motion-….mp4).
 */
export async function assemblerMotion(requestIds: string[], racinePublic = path.join(process.cwd(), "public")): Promise<{ fichier: string; url: string; clips: number }> {
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
    const dossier = path.join(racinePublic, DOSSIER_SORTIE);
    await fs.mkdir(dossier, { recursive: true });
    const nom = `motion-${Date.now().toString(36)}.mp4`;
    await concatLocal(fichiers, path.join(dossier, nom));
    return { fichier: path.join(dossier, nom), url: `/${DOSSIER_SORTIE}/${nom}`, clips: fichiers.length };
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
