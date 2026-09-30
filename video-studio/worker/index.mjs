/**
 * Poste de montage Saturn (PC de Fallou).
 *  1. Récupère les montages demandés dans le studio de Fatou → Video/<id>/ (+ job.json).
 *  2. Surveille Video/ : tout dossier prêt (ou déposé à la main) est monté.
 *  3. Analyse les rushs, demande le plan à Fatou (serveur), rend les variantes avec Remotion.
 *  4. Dépose les rendus dans Outputs/<id>/, les renvoie au studio et affiche une notification.
 * Lancement : `npm start` (ou demarrer.bat).
 */
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { analyzeClip, FFMPEG, keyframe } from "./analyze.mjs";
import { buildVariants, SIZES } from "./edit.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const VIDEO = path.join(ROOT, "Video");
const OUTPUTS = path.join(ROOT, "Outputs");
const PORT = 3907;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v|mkv)$/i;
fs.mkdirSync(VIDEO, { recursive: true });
fs.mkdirSync(OUTPUTS, { recursive: true });

// Logo et poses d'Orbi : copiés depuis l'app (source unique), pour la composition Remotion.
{
  const from = path.resolve(ROOT, "..", "naiom-platform", "public", "brand");
  const to = path.join(ROOT, "public", "brand");
  fs.mkdirSync(to, { recursive: true });
  for (const f of ["saturn-logo-white.png", "saturn-logo-black.png"]) fs.copyFileSync(path.join(from, f), path.join(to, f));
  for (const f of fs.readdirSync(path.join(from, "mascot")).filter((x) => x.endsWith("-cut.png"))) fs.copyFileSync(path.join(from, "mascot", f), path.join(to, f));
}

/* ---------- configuration (.env) ---------- */
const env = Object.fromEntries(
  (fs.existsSync(path.join(ROOT, ".env")) ? fs.readFileSync(path.join(ROOT, ".env"), "utf8") : "")
    .split(/\r?\n/).map((l) => /^\s*([A-Z_]+)\s*=\s*(.*)\s*$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
);
const SATURN = (env.SATURN_URL ?? "https://209-74-71-111.sslip.io").replace(/\/$/, "");
const TOKEN = env.VIDEO_WORKER_TOKEN ?? "";
if (TOKEN.length < 24) {
  console.error("VIDEO_WORKER_TOKEN manquant dans video-studio/.env");
  process.exit(1);
}
const api = (p, init = {}) => fetch(`${SATURN}${p}`, { ...init, headers: { "x-worker-token": TOKEN, ...(init.headers ?? {}) } });
const log = (...a) => console.log(new Date().toLocaleTimeString("fr-FR"), ...a);

/* ---------- serveur local : Remotion lit les rushs en http ---------- */
http.createServer((req, res) => {
  // Le lecteur vidéo de Remotion lit les rushs depuis une autre origine (localhost:3000).
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Range");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Range, Accept-Ranges");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  const rel = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\/+/, "");
  const file = path.resolve(VIDEO, rel);
  if (!file.startsWith(VIDEO + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
  const size = fs.statSync(file).size;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  const type = "video/mp4";
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : size - Number(m[2]);
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
    res.writeHead(206, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": size });
    fs.createReadStream(file).pipe(res);
  }
}).on("error", (e) => {
  console.error(e.code === "EADDRINUSE" ? "Un poste de montage tourne déjà sur ce PC (port " + PORT + " occupé)." : e.message);
  process.exit(1);
}).listen(PORT, "127.0.0.1");
const urlOf = (jobId, name) => `http://127.0.0.1:${PORT}/${encodeURIComponent(jobId)}/${name.split("/").map(encodeURIComponent).join("/")}`;

/* ---------- notification Windows ---------- */
function notify(title, text) {
  const ps = `Add-Type -AssemblyName System.Windows.Forms; $n = New-Object System.Windows.Forms.NotifyIcon; $n.Icon = [System.Drawing.SystemIcons]::Information; $n.Visible = $true; $n.ShowBalloonTip(8000, '${title.replace(/'/g, "")}', '${text.replace(/'/g, "")}', 'Info'); Start-Sleep -Seconds 9; $n.Dispose()`;
  spawn("powershell.exe", ["-NoProfile", "-WindowStyle", "Hidden", "-Command", ps], { detached: true, stdio: "ignore", windowsHide: true }).unref();
}

/* ---------- envoi par morceaux (connexion montante lente : pas de requête de plus de 5 min) ---------- */
const CHUNK = 4 * 1024 * 1024;
async function uploadFile(jobId, file) {
  const name = path.basename(file);
  const size = fs.statSync(file).size;
  const fd = fs.openSync(file, "r");
  try {
    let offset = 0, failures = 0;
    for (;;) {
      const end = Math.min(size, offset + CHUNK);
      const buf = Buffer.alloc(end - offset);
      fs.readSync(fd, buf, 0, buf.length, offset);
      try {
        const r = await api(`/api/video/worker/output/${jobId}?name=${encodeURIComponent(name)}&offset=${offset}${end >= size ? "&final=1" : ""}`, {
          method: "PUT", body: buf, headers: { "Content-Type": "application/octet-stream" },
        });
        const j = await r.json().catch(() => ({}));
        if (r.status === 409 && typeof j.expected === "number") { offset = j.expected; continue; }
        if (!r.ok) throw new Error(`${r.status} ${j.error ?? ""}`);
        failures = 0;
        if (end >= size) return;
        offset = end;
      } catch (e) {
        if (++failures > 6) throw new Error(`Envoi de ${name} impossible : ${e.message}`);
        await new Promise((res) => setTimeout(res, 3000 * failures));
      }
    }
  } finally {
    fs.closeSync(fd);
  }
}

/* ---------- job.json ---------- */
const jobFile = (dir) => path.join(dir, "job.json");
const readJob = (dir) => { try { return JSON.parse(fs.readFileSync(jobFile(dir), "utf8")); } catch { return null; } };
const writeJob = (dir, j) => fs.writeFileSync(jobFile(dir), JSON.stringify(j, null, 2));

let firstPoll = true;
/** Récupère le prochain montage demandé dans le studio et télécharge ses rushs. */
async function pollServer() {
  // 1re requête après démarrage : le serveur rend les montages interrompus (poste arrêté en cours de route).
  const r = await api(`/api/video/worker/next${firstPoll ? "?resume=1" : ""}`);
  firstPoll = false;
  if (!r.ok) throw new Error(`Serveur : ${r.status} ${(await r.text()).slice(0, 120)}`);
  const { job } = await r.json();
  if (!job) return;
  log(`Nouveau montage ${job.id} (${job.clips.length} rush(s), style ${job.style})`);
  const dir = path.join(VIDEO, job.id);
  fs.mkdirSync(dir, { recursive: true });
  writeJob(dir, { ...job, source: "saturn", localStatus: "downloading" });
  try {
    for (const c of job.clips) {
      const local = path.join(dir, c.name);
      if (fs.existsSync(local) && fs.statSync(local).size === c.size) continue;
      const res = await api(`/api/video/worker/source/${job.id}/${encodeURIComponent(c.name)}`);
      if (!res.ok || !res.body) throw new Error(`Téléchargement de ${c.name} impossible (${res.status})`);
      await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(path.join(dir, c.name)));
    }
    writeJob(dir, { ...readJob(dir), localStatus: "ready" });
  } catch (e) {
    writeJob(dir, { ...readJob(dir), localStatus: "failed", error: e.message });
    await api(`/api/video/worker/done/${job.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: e.message }) });
  }
}

/** Dossiers déposés à la main dans Video/ : montés avec les réglages par défaut une fois la copie terminée. */
const sizesSeen = new Map();
function adoptManualDrops() {
  for (const name of fs.readdirSync(VIDEO)) {
    const dir = path.join(VIDEO, name);
    if (!fs.statSync(dir).isDirectory() || fs.existsSync(jobFile(dir))) continue;
    const clips = fs.readdirSync(dir).filter((f) => VIDEO_EXT.test(f));
    if (!clips.length) continue;
    const sig = clips.map((f) => `${f}:${fs.statSync(path.join(dir, f)).size}`).join("|");
    if (sizesSeen.get(dir) !== sig) { sizesSeen.set(dir, sig); continue; } // copie encore en cours
    log(`Dossier déposé à la main : ${name}`);
    writeJob(dir, {
      id: name, source: "local", localStatus: "ready", title: name.replace(/[-_]+/g, " "), cta: "", style: "rapide",
      formats: ["9:16"], duration: 0, variants: 3, assets: { intro: true, logo: true, titles: true, endCard: true, orbi: true },
      clips: clips.map((f) => ({ name: f })),
    });
  }
}

/* ---------- montage ---------- */
let serveUrl = null;
async function getBundle() {
  if (!serveUrl) {
    log("Préparation de Remotion…");
    serveUrl = await bundle({ entryPoint: path.join(ROOT, "src", "index.ts"), publicDir: path.join(ROOT, "public") });
  }
  return serveUrl;
}

async function processJob(dir) {
  const job = readJob(dir);
  writeJob(dir, { ...job, localStatus: "rendering" });
  const out = path.join(OUTPUTS, job.id);
  fs.mkdirSync(out, { recursive: true });
  const t0 = Date.now();
  try {
    // 0. Rushs normalisés (H.264, 30 i/s constants, une image clé par seconde) : le décodeur
    //    de Remotion perd des images sur certains encodages de téléphone ou d'appareil photo.
    const raw = job.clips.map((c) => path.join(dir, c.name)).filter((f) => fs.existsSync(f));
    const normDir = path.join(dir, "_norm");
    fs.mkdirSync(normDir, { recursive: true });
    const clipFiles = [];
    for (let i = 0; i < raw.length; i++) {
      const dest = path.join(normDir, `${i}.mp4`);
      if (!fs.existsSync(dest)) {
        log(`${job.id} : préparation du rush ${i + 1}/${raw.length}…`);
        await new Promise((resolve, reject) => {
          const p = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-i", raw[i], "-vf", "scale='min(1920,iw)':-2", "-r", "30",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-g", "30", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-ar", "48000",
            "-movflags", "+faststart", `${dest}.part.mp4`], { windowsHide: true });
          let err = ""; p.stderr.on("data", (d) => (err += d));
          p.on("close", (c) => (c === 0 ? resolve() : reject(new Error(`Rush ${path.basename(raw[i])} illisible : ${err.slice(-200)}`))));
        });
        fs.renameSync(`${dest}.part.mp4`, dest);
      }
      clipFiles.push(dest);
    }
    // 1. Analyse des rushs.
    const analyses = [];
    for (let i = 0; i < clipFiles.length; i++) analyses.push(await analyzeClip(clipFiles[i], i));
    const units = analyses.flatMap((a) => a.units).map((u, i) => ({ id: `u${i}`, ...u }));
    if (!units.length) throw new Error("Aucun passage exploitable dans les rushs.");
    // Une image clé par unité (24 au plus, réparties).
    const step = Math.max(1, Math.ceil(units.length / 24));
    const keyframes = [];
    for (let i = 0; i < units.length; i += step) {
      const u = units[i];
      keyframes.push({ unit: u.id, jpeg: await keyframe(clipFiles[u.clip], (u.from + u.to) / 2) });
    }
    log(`${job.id} : ${units.length} unités analysées, demande du plan à Fatou…`);

    // 2. Plan de Fatou.
    const saved = path.join(out, "plan.json");
    const reuse = fs.existsSync(saved) ? JSON.parse(fs.readFileSync(saved, "utf8")) : null;
    const pr = reuse ? { ok: true, json: async () => reuse.plan } : await api("/api/video/worker/plan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job: { title: job.title, cta: job.cta, style: job.style, duration: job.duration, guidance: job.guidance, previousPlan: job.plan },
        clips: analyses.map((a) => a.info), units, keyframes,
      }),
    });
    const plan = await pr.json();
    if (!pr.ok) throw new Error(plan.error ?? `Plan impossible (${pr.status})`);
    fs.writeFileSync(path.join(out, "plan.json"), JSON.stringify({ plan, units }, null, 2));

    // 3. Variantes × formats.
    const variants = buildVariants(units, plan, (ci) => urlOf(path.basename(dir), `_norm/${ci}.mp4`), job,
      (ci) => (analyses[ci].info.width && analyses[ci].info.height ? analyses[ci].info.width / analyses[ci].info.height : 16 / 9));
    const url = await getBundle();
    const outputs = [];
    for (const v of variants) {
      for (const fmt of job.formats) {
        const [width, height] = SIZES[fmt] ?? SIZES["9:16"];
        const inputProps = { width, height, fps: 30, style: job.style, segments: v.segments, hook: plan.hook, cta: plan.cta, variantLabel: v.label, assets: job.assets };
        const composition = await selectComposition({ serveUrl: url, id: "Montage", inputProps });
        const base = `${v.key}-${fmt.replace(":", "x")}`;
        const ok = path.join(out, `${base}.ok`);
        if (!fs.existsSync(ok)) {
          log(`${job.id} : rendu ${v.label} ${fmt} (${Math.round(composition.durationInFrames / 30)} s)…`);
          // CRF 23 : qualité largement suffisante pour les réseaux (qui recompressent), fichiers 2 à 3 fois plus légers.
          await renderMedia({ composition, serveUrl: url, codec: "h264", crf: 23, concurrency: 4, outputLocation: path.join(out, `${base}.mp4`), inputProps, imageFormat: "jpeg", jpegQuality: 88 });
          await renderStill({ composition, serveUrl: url, output: path.join(out, `${base}.jpg`), inputProps, frame: Math.min(24, composition.durationInFrames - 1), imageFormat: "jpeg", jpegQuality: 85 });
          fs.writeFileSync(ok, "");
        }
        outputs.push({ file: `${base}.mp4`, thumb: `${base}.jpg`, format: fmt, variant: v.key, label: v.label, seconds: +(composition.durationInFrames / 30).toFixed(1) });
      }
    }

    // 4. Renvoi au studio.
    if (job.source === "saturn") {
      for (const o of outputs) {
        for (const f of [o.thumb, o.file]) {
          log(`${job.id} : envoi de ${f} au studio…`);
          await uploadFile(job.id, path.join(out, f));
        }
      }
      await api(`/api/video/worker/done/${job.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outputs, plan }) });
    }
    writeJob(dir, { ...readJob(dir), localStatus: "done", outputs });
    const mins = Math.round((Date.now() - t0) / 6000) / 10;
    log(`${job.id} terminé : ${outputs.length} vidéo(s) en ${mins} min → ${out}`);
    notify("Saturn · nouveau montage", `${outputs.length} vidéo(s) prêtes : ${job.title || job.id}`);
  } catch (e) {
    log(`${job.id} ÉCHEC : ${e.message}`);
    writeJob(dir, { ...readJob(dir), localStatus: "failed", error: e.message });
    if (job.source === "saturn")
      await api(`/api/video/worker/done/${job.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: e.message }) }).catch(() => {});
    notify("Saturn · montage échoué", e.message.slice(0, 120));
  }
}

/* ---------- boucle ---------- */
let busy = false;
async function tick() {
  if (busy) return;
  busy = true;
  try {
    await pollServer().catch((e) => log("Serveur injoignable :", e.message));
    adoptManualDrops();
    for (const name of fs.readdirSync(VIDEO)) {
      const dir = path.join(VIDEO, name);
      if (fs.statSync(dir).isDirectory() && readJob(dir)?.localStatus === "ready") await processJob(dir);
    }
  } finally {
    busy = false;
  }
}

log(`Poste de montage Saturn prêt — dossiers : ${VIDEO} → ${OUTPUTS} — serveur : ${SATURN}`);
await tick();
setInterval(tick, 10_000);
