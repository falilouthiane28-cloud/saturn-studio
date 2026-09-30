/**
 * Montages vidéo de Fatou : jobs créés dans le studio, rendus par le poste de montage
 * (PC de Fallou, Remotion) qui les récupère via /api/video/worker/*.
 * Fichiers : content/video/<id>/src (rushs) et content/video/<id>/out (rendus).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash, timingSafeEqual } from "node:crypto";
import { REPO_ROOT } from "@/lib/paths";

export const VIDEO_DIR = path.join(REPO_ROOT, "content", "video");
const STORE = path.join(VIDEO_DIR, "jobs.json");
const WORKER_FILE = path.join(VIDEO_DIR, "worker.json");

export type VideoStyle = "rapide" | "informatif" | "suspense" | "humour";
export type VideoFormat = "9:16" | "4:5" | "1:1" | "16:9";
export const STYLES: VideoStyle[] = ["rapide", "informatif", "suspense", "humour"];
export const FORMATS: VideoFormat[] = ["9:16", "4:5", "1:1", "16:9"];

export interface VideoAssets { intro: boolean; logo: boolean; titles: boolean; endCard: boolean; orbi: boolean }
export interface VideoOutput { file: string; thumb?: string; format: VideoFormat; variant: string; label: string; seconds: number }
export interface VideoFeedback { rating: number; note: string; variant?: string; at: string }

export interface VideoJob {
  id: string;
  createdAt: string;
  status: "uploading" | "queued" | "rendering" | "done" | "failed";
  title: string; // sujet / accroche souhaitée (Fatou s'en inspire pour les textes à l'écran)
  cta: string;
  style: VideoStyle;
  formats: VideoFormat[];
  duration: number; // durée visée en secondes (0 = automatique)
  variants: number;
  assets: VideoAssets;
  clips: { name: string; size: number }[];
  parentId?: string; // itération d'un montage précédent
  guidance?: string; // retour de Fallou à appliquer (itération)
  outputs?: VideoOutput[];
  plan?: unknown;
  feedback?: VideoFeedback[];
  error?: string;
  startedAt?: string;
  doneAt?: string;
}

async function read(): Promise<VideoJob[]> {
  try { return (JSON.parse(await fs.readFile(STORE, "utf-8")) as { jobs: VideoJob[] }).jobs; }
  catch { return []; }
}
async function write(jobs: VideoJob[]): Promise<void> {
  await fs.mkdir(VIDEO_DIR, { recursive: true });
  await fs.writeFile(STORE, JSON.stringify({ jobs }, null, 2), "utf-8");
}

export async function listJobs(): Promise<VideoJob[]> {
  return (await read()).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
export async function getJob(id: string): Promise<VideoJob | null> {
  return (await read()).find((j) => j.id === id) ?? null;
}
export async function addJob(j: Omit<VideoJob, "id" | "createdAt" | "status" | "clips">): Promise<VideoJob> {
  const jobs = await read();
  const job: VideoJob = { ...j, id: `vid-${Date.now().toString(36)}`, createdAt: new Date().toISOString(), status: "uploading", clips: [] };
  jobs.unshift(job);
  await write(jobs);
  return job;
}
export async function updateJob(id: string, patch: Partial<VideoJob> | ((j: VideoJob) => Partial<VideoJob>)): Promise<VideoJob | null> {
  const jobs = await read();
  const i = jobs.findIndex((j) => j.id === id);
  if (i < 0) return null;
  jobs[i] = { ...jobs[i], ...(typeof patch === "function" ? patch(jobs[i]) : patch) };
  await write(jobs);
  return jobs[i];
}
export async function deleteJob(id: string): Promise<void> {
  await write((await read()).filter((j) => j.id !== id));
  await fs.rm(jobDir(id), { recursive: true, force: true });
}

/** Réserve le plus ancien job en attente pour le poste de montage. */
export async function claimNext(): Promise<VideoJob | null> {
  const jobs = await read();
  const next = [...jobs].reverse().find((j) => j.status === "queued");
  if (!next) return null;
  next.status = "rendering";
  next.startedAt = new Date().toISOString();
  await write(jobs);
  return next;
}

export const jobDir = (id: string) => path.join(VIDEO_DIR, id.replace(/[^a-z0-9-]/gi, ""));

/** Nom de fichier sûr (pas de chemin, caractères limités). */
export function safeName(name: string): string {
  const base = path.basename(String(name ?? "")).normalize("NFD").replace(/[̀-ͯ]/g, "");
  const clean = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+/, "").slice(0, 100);
  if (!clean || !/\.[a-z0-9]{2,5}$/i.test(clean)) throw new Error("Nom de fichier invalide.");
  return clean;
}

/* ---------- poste de montage (jeton + présence) ---------- */
export function workerAuthorized(req: Request): boolean {
  const expected = process.env.VIDEO_WORKER_TOKEN ?? "";
  const given = req.headers.get("x-worker-token") ?? "";
  if (expected.length < 24 || !given) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(given).digest();
  return timingSafeEqual(a, b);
}
export async function touchWorker(): Promise<void> {
  await fs.mkdir(VIDEO_DIR, { recursive: true });
  await fs.writeFile(WORKER_FILE, JSON.stringify({ lastSeen: Date.now() }), "utf-8");
}
export async function workerLastSeen(): Promise<number | null> {
  try { return (JSON.parse(await fs.readFile(WORKER_FILE, "utf-8")) as { lastSeen: number }).lastSeen; }
  catch { return null; }
}
