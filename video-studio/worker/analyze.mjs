/**
 * Analyse d'un rush avec le ffmpeg fourni par Remotion : durée, passages parlés (détection
 * de silence), changements de plan (différence entre images réduites), puis découpe en
 * « unités » montables (jamais au milieu d'une phrase) et une image clé par unité.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const BIN = path.dirname(require.resolve("@remotion/compositor-win32-x64-msvc/package.json"));
export const FFMPEG = path.join(BIN, "ffmpeg.exe");
export const FFPROBE = path.join(BIN, "ffprobe.exe");

function run(bin, args) {
  return new Promise((resolve, reject) => {
    const p = spawn(bin, args, { windowsHide: true });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve({ out, err }) : reject(new Error(`${path.basename(bin)} a échoué (${code}) : ${err.slice(-400)}`))));
  });
}

export async function probe(file) {
  const { out } = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", file]);
  const j = JSON.parse(out);
  const v = j.streams.find((s) => s.codec_type === "video");
  return { duration: Number(j.format.duration) || 0, width: v?.width ?? 0, height: v?.height ?? 0, hasAudio: j.streams.some((s) => s.codec_type === "audio") };
}

/** Passages parlés = complément des silences (> 0,4 s sous -35 dB). */
async function speechRegions(file, duration) {
  const { err } = await run(FFMPEG, ["-hide_banner", "-nostats", "-i", file, "-vn", "-af", "silencedetect=noise=-35dB:d=0.4", "-f", "null", "-"]);
  const silences = [];
  let start = null;
  for (const line of err.split(/\r?\n/)) {
    const s = /silence_start: ([\d.]+)/.exec(line);
    const e = /silence_end: ([\d.]+)/.exec(line);
    if (s) start = Number(s[1]);
    if (e) { silences.push([start ?? 0, Number(e[1])]); start = null; }
  }
  if (start !== null) silences.push([start, duration]);
  const regions = [];
  let t = 0;
  for (const [a, b] of silences) { if (a - t > 0.25) regions.push([t, a]); t = b; }
  if (duration - t > 0.25) regions.push([t, duration]);
  return regions;
}

/** Changements de plan : images 48×27 en niveaux de gris à 4 i/s, écart moyen entre images voisines. */
async function shotCuts(file, duration) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "shots-"));
  try {
    await run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", file, "-an", "-vf", "scale=48:27", "-r", "4", "-q:v", "10", path.join(dir, "%05d.jpg")]);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jpg")).sort();
    const frames = await Promise.all(files.map((f) => sharp(path.join(dir, f)).greyscale().raw().toBuffer()));
    const diffs = [0];
    for (let i = 1; i < frames.length; i++) {
      const a = frames[i - 1], b = frames[i];
      let d = 0;
      for (let k = 0; k < a.length; k++) d += Math.abs(a[k] - b[k]);
      diffs.push(d / a.length);
    }
    const cuts = [];
    for (let i = 1; i < diffs.length; i++) {
      const around = diffs.slice(Math.max(1, i - 6), i + 6).filter((_, k, arr) => arr[k] !== diffs[i]).sort((x, y) => x - y);
      const median = around[Math.floor(around.length / 2)] ?? 0;
      const t = i / 4;
      if (diffs[i] > 22 && diffs[i] > median * 2.5 && (!cuts.length || t - cuts[cuts.length - 1] > 0.8) && t < duration - 0.5) cuts.push(t);
    }
    return cuts;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Unités montables d'un rush. */
export async function analyzeClip(file, index) {
  const info = await probe(file);
  const speech = info.hasAudio ? await speechRegions(file, info.duration) : [];
  const spoken = speech.reduce((a, [x, y]) => a + (y - x), 0);
  const hasSpeech = spoken > Math.min(3, info.duration * 0.15);
  const cuts = await shotCuts(file, info.duration);
  const units = [];
  if (hasSpeech) {
    // Phrases (avec 0,12 s de marge), regroupées si le blanc est court, découpées aux plans si trop longues.
    const merged = [];
    for (const [a, b] of speech) {
      const x = Math.max(0, a - 0.12), y = Math.min(info.duration, b + 0.12);
      if (merged.length && x - merged[merged.length - 1][1] < 0.35) merged[merged.length - 1][1] = y;
      else merged.push([x, y]);
    }
    for (const [a, b] of merged) {
      let start = a;
      for (const c of cuts.filter((c) => c > a + 4 && c < b - 4)) { if (c - start > 12) { units.push([start, c]); start = c; } }
      units.push([start, b]);
    }
  } else {
    const bounds = [0, ...cuts, info.duration];
    for (let i = 0; i < bounds.length - 1; i++) {
      const [a, b] = [bounds[i], bounds[i + 1]];
      const n = Math.max(1, Math.round((b - a) / 3.5));
      for (let k = 0; k < n; k++) units.push([a + ((b - a) * k) / n, a + ((b - a) * (k + 1)) / n]);
    }
  }
  return {
    info: { index, name: path.basename(file), duration: info.duration, hasSpeech, width: info.width, height: info.height },
    units: units.filter(([a, b]) => b - a >= 0.6).map(([a, b]) => ({ clip: index, from: +a.toFixed(2), to: +b.toFixed(2), kind: hasSpeech ? "speech" : "shot" })),
  };
}

/** Image clé (jpeg base64, 384 px de large) au milieu d'une unité. */
export async function keyframe(file, t) {
  const out = path.join(os.tmpdir(), `kf-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`);
  try {
    await run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-ss", String(t), "-i", file, "-frames:v", "1", "-vf", "scale=384:-2", "-q:v", "6", "-y", out]);
    return fs.readFileSync(out).toString("base64");
  } finally {
    fs.rmSync(out, { force: true });
  }
}
