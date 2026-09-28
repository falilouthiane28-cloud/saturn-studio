/**
 * Higgsfield — jobs d'images asynchrones (Creative Studio de Mia, visuels de posts de Fatou).
 *
 * Passe par l'API REST (platform.higgsfield.ai, clé HIGGSFIELD_API_KEY) et non
 * plus par le CLI + OAuth : le CLI n'existe pas dans le conteneur de production.
 * Les signatures d'origine sont conservées pour ne pas toucher aux appelants.
 */
import path from "node:path";
import { BASE, call, imageUrlOf, isHiggsfieldApiConfigured, type Status } from "@/lib/integrations/higgsfieldApi";

const TEXT_MODEL = "higgsfield-ai/soul/standard";
// Édition à partir d'images de référence (1 à 3 URL publiques).
const EDIT_MODEL = process.env.HIGGSFIELD_EDIT_MODEL ?? "alibaba/qwen-image-3/edit";
const EDIT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "7:9", "9:7", "9:16", "16:9", "21:9"];

export function isHiggsfieldConfigured(): boolean {
  return isHiggsfieldApiConfigured();
}

/** Formats UI → aspect_ratio accepté par l'API (pas de 4:5 : le plus proche est 3:4). */
export const SOUL_ASPECT: Record<string, string> = {
  "1:1": "1:1", "9:16": "9:16", "16:9": "16:9", "4:5": "3:4",
};

export interface SoulParams {
  prompt: string;
  format?: string;
  quality?: "1.5k" | "2k";
  negativePrompt?: string; // non natif → intégré au prompt
  seed?: number;
}

export interface SoulJob { requestId: string; statusUrl: null }

type Created = { request_id?: string };

function statusOf(raw: string): "queued" | "in_progress" | "completed" | "failed" | "unknown" {
  const r = raw.toLowerCase();
  if (r === "completed" || r === "succeeded") return "completed";
  if (r.includes("fail") || r.includes("error") || r === "canceled" || r === "nsfw") return "failed";
  if (r.includes("progress") || r.includes("run")) return "in_progress";
  if (r.includes("queue") || r.includes("pending")) return "queued";
  return "unknown";
}

async function getStatus(id: string): Promise<Status> {
  return call<Status>(`${BASE}/requests/${encodeURIComponent(id)}/status`);
}

/** Lance une génération texte → image. Renvoie l'id de la requête. */
export async function generateSoul(p: SoulParams): Promise<SoulJob> {
  const prompt = p.negativePrompt
    ? `${p.prompt}\n\n(avoid: ${p.negativePrompt}. No text, no letters, no watermark.)`
    : p.prompt;
  const body: Record<string, unknown> = { prompt, aspect_ratio: SOUL_ASPECT[p.format ?? "1:1"] ?? "1:1", resolution: "720p" };
  if (typeof p.seed === "number") body.seed = p.seed;
  const r = await call<Created>(`${BASE}/${TEXT_MODEL}`, { method: "POST", body: JSON.stringify(body) });
  if (!r.request_id) throw new Error("Higgsfield : aucune requête créée.");
  return { requestId: r.request_id, statusUrl: null };
}

export interface SoulResult {
  status: "queued" | "in_progress" | "completed" | "failed" | "unknown";
  imageUrl: string | null;
  thumbUrl: string | null;
}

export async function pollSoul(job: { requestId?: string }): Promise<SoulResult> {
  if (!job.requestId) throw new Error("Aucun id de job Higgsfield.");
  const s = await getStatus(job.requestId);
  const url = imageUrlOf(s) ?? null;
  return { status: statusOf(s.status ?? ""), imageUrl: url, thumbUrl: url };
}

/* ============ Générique (édition à partir de références) ============ */
export interface HfJobResult {
  status: "queued" | "in_progress" | "completed" | "failed" | "unknown";
  imageUrl: string | null;
}

/** Chemin local d'un fichier de public/ → URL publique (Higgsfield télécharge lui-même les références). */
function publicUrlFor(ref: string): string {
  if (/^https:\/\//.test(ref)) return ref;
  const publicDir = path.join(process.cwd(), "public");
  const rel = path.relative(publicDir, path.resolve(ref));
  if (rel.startsWith("..")) throw new Error(`Référence hors de public/ : ${path.basename(ref)}.`);
  const base = process.env.PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!base) throw new Error("PUBLIC_SITE_URL absente : Higgsfield ne peut pas télécharger les images de référence.");
  return `${base}/${rel.split(path.sep).map(encodeURIComponent).join("/")}`;
}

/** Crée un job image. Avec des références → modèle d'édition ; sans → texte → image. */
export async function hfCreate(
  _jobType: string,
  prompt: string,
  imageRefs: string[] = [],
  params: Record<string, string> = {}
): Promise<string> {
  const aspect = SOUL_ASPECT[params.aspect_ratio ?? ""] ?? params.aspect_ratio ?? "1:1";
  let r: Created;
  if (imageRefs.length) {
    r = await call<Created>(`${BASE}/${EDIT_MODEL}`, {
      method: "POST",
      body: JSON.stringify({
        prompt,
        image_urls: imageRefs.slice(0, 3).map(publicUrlFor),
        aspect_ratio: EDIT_RATIOS.includes(aspect) ? aspect : "1:1",
        resolution: params.resolution === "1k" ? "1k" : "2k",
      }),
    });
  } else {
    r = await call<Created>(`${BASE}/${TEXT_MODEL}`, {
      method: "POST",
      body: JSON.stringify({ prompt, aspect_ratio: aspect, resolution: "720p" }),
    });
  }
  if (!r.request_id) throw new Error("Higgsfield : aucune requête créée.");
  return r.request_id;
}

export async function hfGet(id: string): Promise<HfJobResult> {
  const s = await getStatus(id);
  return { status: statusOf(s.status ?? ""), imageUrl: imageUrlOf(s) ?? null };
}
