/**
 * Higgsfield — vidéo texte → vidéo (Seedance 2.5), pour les Reels motion design de Fatou.
 * Endpoint et champs repris de la doc officielle :
 * open.higgsfield.ai/models/bytedance/seedance-2.5/text-to-video/api-reference
 * Même client que les images (clé « id:secret » dans HIGGSFIELD_API_KEY) ; job asynchrone :
 * on lance, on garde le request_id, on interroge /requests/{id}/status.
 * Chaque génération dépense des crédits : l'appelant doit avoir l'accord du propriétaire.
 */
import { BASE, call, isHiggsfieldApiConfigured } from "./higgsfieldApi.ts";

const VIDEO_MODEL = process.env.HIGGSFIELD_VIDEO_MODEL ?? "bytedance/seedance-2.5/text-to-video";
export const RATIOS_VIDEO = ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9"] as const;
export const RESOLUTIONS_VIDEO = ["480p", "720p", "1080p"] as const;
/** Plafond Saturn (le modèle accepte 4 à 30 s) : un Reel se monte en plans courts, et ça limite la dépense. */
export const DUREE_MAX = 15;

export interface VideoDemande {
  prompt: string;
  duree?: number;
  format?: (typeof RATIOS_VIDEO)[number];
  resolution?: (typeof RESOLUTIONS_VIDEO)[number];
  audio?: boolean;
}

export interface VideoStatut {
  requestId: string;
  status: "queued" | "in_progress" | "completed" | "failed" | "unknown";
  videoUrl: string | null;
}

/** Corps exact envoyé à l'API, vérifié et borné (testé sans réseau). */
export function corpsVideo(d: VideoDemande): Record<string, unknown> {
  const prompt = d.prompt?.trim();
  if (!prompt) throw new Error("Prompt vidéo vide.");
  if (prompt.length > 4000) throw new Error("Prompt vidéo trop long (4000 caractères maximum).");
  const duree = Math.round(d.duree ?? 5);
  if (!(duree >= 4 && duree <= DUREE_MAX)) throw new Error(`Durée : de 4 à ${DUREE_MAX} secondes.`);
  const format = d.format ?? "9:16";
  if (!RATIOS_VIDEO.includes(format)) throw new Error(`Format non accepté : ${format}.`);
  const resolution = d.resolution ?? "720p";
  if (!RESOLUTIONS_VIDEO.includes(resolution)) throw new Error(`Résolution non acceptée : ${resolution}.`);
  return { prompt, duration: duree, aspect_ratio: format, resolution, output_format: "mp4", generate_audio: d.audio ?? false };
}

function statusOf(raw: string): VideoStatut["status"] {
  const r = raw.toLowerCase();
  if (r === "completed" || r === "succeeded") return "completed";
  if (r.includes("fail") || r.includes("error") || r === "canceled" || r === "nsfw") return "failed";
  if (r.includes("progress") || r.includes("run")) return "in_progress";
  if (r.includes("queue") || r.includes("pending")) return "queued";
  return "unknown";
}

type RepStatut = { status?: string; video?: { url?: string } | string; output?: string | string[] };
export function videoUrlOf(s: RepStatut): string | null {
  if (typeof s.video === "string") return s.video;
  if (s.video?.url) return s.video.url;
  const out = Array.isArray(s.output) ? s.output[0] : s.output;
  return out ?? null;
}

/** Lance la génération ; renvoie le request_id à garder pour suivre le job. */
export async function lancerVideo(d: VideoDemande): Promise<string> {
  if (!isHiggsfieldApiConfigured()) throw new Error("Higgsfield non connecté : ajoute HIGGSFIELD_API_KEY (« id:secret ») dans .env.local du serveur.");
  const r = await call<{ request_id?: string }>(`${BASE}/${VIDEO_MODEL}`, { method: "POST", body: JSON.stringify(corpsVideo(d)) });
  if (!r.request_id) throw new Error("Higgsfield : aucune requête vidéo créée.");
  return r.request_id;
}

export async function statutVideo(requestId: string): Promise<VideoStatut> {
  if (!/^[\w-]{6,80}$/.test(requestId)) throw new Error("request_id invalide.");
  const s = await call<RepStatut>(`${BASE}/requests/${encodeURIComponent(requestId)}/status`);
  return { requestId, status: statusOf(s.status ?? ""), videoUrl: videoUrlOf(s) };
}
