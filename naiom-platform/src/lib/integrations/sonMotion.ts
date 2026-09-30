/**
 * Sound design des vidéos motion design : effets synthétisés par ffmpeg (aucun fichier externe,
 * aucun droit d'auteur, aucun crédit) et placés sur la chronologie des scènes :
 *  - whoosh à chaque changement de scène, pop à l'apparition d'un titre, cliquetis de frappe ;
 *  - drone grave pendant la TENSION ; riser, impact et scintillement sur le LOGO ;
 *  - nappe d'ambiance douce sous toute la vidéo.
 * La narration du propriétaire (fichier envoyé) peut être ajoutée : la nappe et les effets
 * baissent automatiquement sous la voix (compression en sidechain).
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { TypeScene } from "../instagram/motion.ts";

const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

export type Sfx = "whoosh" | "pop" | "tick" | "riser" | "impact" | "shimmer" | "drone";
export interface EvenementSon { sfx: Sfx; debut: number; gain: number; duree?: number }
export interface SceneSon { type: TypeScene; debut: number; fin: number; aTitre: boolean; frappes?: number[] }

/** Recettes ffmpeg (lavfi) de chaque effet : durées courtes, mono 44,1 kHz. */
const RECETTES: Record<Sfx, string[]> = {
  whoosh: ["-f", "lavfi", "-i", "anoisesrc=d=0.7:c=pink:a=0.9:r=44100", "-af", "highpass=f=250,lowpass=f=5000,afade=t=in:st=0:d=0.45,afade=t=out:st=0.45:d=0.25,volume=0.9"],
  pop: ["-f", "lavfi", "-i", "aevalsrc='0.8*sin(2*PI*(900-500*t/0.09)*t)*exp(-40*t)':d=0.12:s=44100"],
  tick: ["-f", "lavfi", "-i", "anoisesrc=d=0.035:c=white:a=0.6:r=44100", "-af", "highpass=f=1800,afade=t=out:st=0.005:d=0.03"],
  riser: ["-f", "lavfi", "-i", "aevalsrc='0.35*sin(2*PI*(150+700*t*t/1.6)*t)*(t/1.6)':d=1.6:s=44100", "-af", "afade=t=in:st=0:d=0.8"],
  impact: ["-f", "lavfi", "-i", "aevalsrc='0.95*sin(2*PI*52*t)*exp(-3.5*t)+0.25*sin(2*PI*104*t)*exp(-6*t)':d=1.4:s=44100", "-af", "lowpass=f=900"],
  shimmer: ["-f", "lavfi", "-i", "aevalsrc='0.12*(sin(2*PI*1760*t)+sin(2*PI*2217*t)+sin(2*PI*2637*t))*exp(-2.2*t)':d=1.8:s=44100", "-af", "aecho=0.6:0.5:120|240:0.35|0.2"],
  drone: ["-f", "lavfi", "-i", "aevalsrc='0.4*sin(2*PI*55*t)*(0.75+0.25*sin(2*PI*0.5*t))+0.15*sin(2*PI*82.4*t)':d=12:s=44100", "-af", "lowpass=f=400"],
};

function ffmpeg(args: string[], timeoutMs = 120_000): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...args], { timeout: timeoutMs, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, _o, stderr) => {
      if (err) reject(new Error(`ffmpeg (son) a échoué : ${String(stderr || err.message).slice(0, 300)}`)); else resolve();
    });
  });
}

/** Génère les effets (WAV) dans `dossier` ; renvoie leurs chemins. */
export async function genererSfx(dossier: string): Promise<Record<Sfx, string>> {
  await fs.mkdir(dossier, { recursive: true });
  const sorties = {} as Record<Sfx, string>;
  for (const [nom, recette] of Object.entries(RECETTES) as [Sfx, string[]][]) {
    const f = path.join(dossier, `${nom}.wav`);
    await ffmpeg([...recette, "-ac", "1", f]);
    sorties[nom] = f;
  }
  return sorties;
}

/** Plan sonore d'une vidéo : où tombe chaque effet (en secondes depuis le début). */
export function planSon(scenes: SceneSon[]): EvenementSon[] {
  const ev: EvenementSon[] = [];
  const logo = scenes.find((s) => s.type === "LOGO");
  scenes.forEach((s, i) => {
    if (i > 0) ev.push({ sfx: "whoosh", debut: Math.max(0, s.debut - 0.3), gain: 0.55 });
    if (s.aTitre) {
      if (s.frappes?.length) {
        const tape = s.type === "UI" || s.frappes.length > 8; // frappe lettre par lettre : cliquetis ; mots : petits pops
        for (const t of s.frappes) ev.push({ sfx: tape ? "tick" : "pop", debut: s.debut + t, gain: tape ? 0.35 : 0.3 });
      } else if (s.type !== "LOGO") ev.push({ sfx: "pop", debut: s.debut + 0.25, gain: 0.4 });
    }
    if (s.type === "TENSION") ev.push({ sfx: "drone", debut: s.debut, gain: 0.45, duree: s.fin - s.debut });
  });
  if (logo) {
    ev.push({ sfx: "riser", debut: Math.max(0, logo.debut - 1.6), gain: 0.5 });
    ev.push({ sfx: "impact", debut: logo.debut, gain: 0.8 });
    ev.push({ sfx: "shimmer", debut: logo.debut + 0.15, gain: 0.6 });
  }
  return ev.sort((a, b) => a.debut - b.debut);
}

/**
 * Arguments ffmpeg du mixage : la vidéo muette + la nappe + les effets (+ narration éventuelle),
 * vidéo copiée telle quelle, audio AAC. Chaque effet est dupliqué (asplit) puis retardé (adelay).
 */
export function argsMix(video: string, sfx: Record<Sfx, string>, evenements: EvenementSon[], duree: number, sortie: string, narration?: string): string[] {
  const noms = [...new Set(evenements.map((e) => e.sfx))];
  const entrees = ["-i", video, ...noms.flatMap((n) => ["-i", sfx[n]])];
  const iNarr = narration ? 1 + noms.length : -1;
  if (narration) entrees.push("-i", narration);
  const f: string[] = [];
  const pistes: string[] = [];
  noms.forEach((n, k) => {
    const evs = evenements.filter((e) => e.sfx === n);
    const labels = evs.map((_, j) => `[${n}${j}]`);
    f.push(`[${k + 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,asplit=${evs.length}${labels.join("")}`);
    evs.forEach((e, j) => {
      const ms = Math.round(e.debut * 1000);
      const coupe = e.duree ? `atrim=0:${e.duree.toFixed(2)},afade=t=out:st=${Math.max(0, e.duree - 0.4).toFixed(2)}:d=0.4,` : "";
      f.push(`${labels[j]}${coupe}volume=${e.gain},adelay=${ms}|${ms}[e_${n}${j}]`);
      pistes.push(`[e_${n}${j}]`);
    });
  });
  // Nappe d'ambiance : accord doux (la mineur add9), filtré, trémolo lent, fondu d'entrée et de sortie.
  const d = duree.toFixed(2);
  f.push(`aevalsrc='0.06*(sin(2*PI*220*t)+sin(2*PI*261.63*t)+sin(2*PI*329.63*t)+0.6*sin(2*PI*493.88*t))':d=${d}:s=44100,lowpass=f=1400,tremolo=f=0.3:d=0.3,aformat=channel_layouts=stereo,afade=t=in:st=0:d=1.5,afade=t=out:st=${Math.max(0, duree - 1.5).toFixed(2)}:d=1.5[nappe]`);
  f.push(`[nappe]${pistes.join("")}amix=inputs=${pistes.length + 1}:normalize=0:dropout_transition=0[fx]`);
  if (narration) {
    // Voix complétée par du silence (ou coupée) à la durée de la vidéo : sinon le compresseur attend
    // la suite d'une voix terminée et le mixage se bloque.
    f.push(`[${iNarr}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=1.4,apad=whole_dur=${d},atrim=0:${d},asplit=2[voix][cle]`);
    f.push(`[fx][cle]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[fxb]`);
    f.push(`[fxb][voix]amix=inputs=2:normalize=0[mix]`);
  } else f.push(`[fx]anull[mix]`);
  f.push(`[mix]alimiter=limit=0.9,apad,atrim=0:${d}[aout]`);
  return [...entrees, "-filter_complex", f.join(";"), "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", d, "-movflags", "+faststart", sortie];
}

/** Ajoute le sound design (et la narration éventuelle) à une vidéo muette. */
export async function sonoriser(video: string, scenes: SceneSon[], duree: number, sortie: string, travail: string, narration?: string): Promise<string> {
  const sfx = await genererSfx(path.join(travail, "sfx"));
  const ev = planSon(scenes);
  await ffmpeg(argsMix(video, sfx, ev, duree, sortie, narration), 240_000);
  return sortie;
}
