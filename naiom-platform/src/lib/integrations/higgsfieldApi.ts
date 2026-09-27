/**
 * Higgsfield — API REST (platform.higgsfield.ai), pour les visuels héros de Léa.
 * Clé « id:secret » dans HIGGSFIELD_API_KEY (tableau de bord Higgsfield → API keys).
 * Base commune : lib/integrations/higgsfield.ts s'appuie aussi sur ce client (jobs asynchrones).
 */
export const BASE = "https://platform.higgsfield.ai";
const MODEL = process.env.HIGGSFIELD_IMAGE_MODEL ?? "higgsfield-ai/soul/standard";

export function isHiggsfieldApiConfigured(): boolean {
  return /^[^:\s]+:[^:\s]+$/.test(process.env.HIGGSFIELD_API_KEY ?? "");
}

export async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Key ${process.env.HIGGSFIELD_API_KEY}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    if (/not_enough_credits/.test(text)) throw new Error("Crédits Higgsfield épuisés : rechargez le compte sur higgsfield.ai.");
    if (res.status === 401) throw new Error("Clé Higgsfield refusée (HIGGSFIELD_API_KEY).");
    throw new Error(`Higgsfield ${res.status} : ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as T;
}

export type Status = {
  status?: string;
  images?: { url?: string }[];
  image?: { url?: string };
  result?: { url?: string };
  output?: string | string[];
};

export function imageUrlOf(s: Status): string | undefined {
  const out = Array.isArray(s.output) ? s.output[0] : s.output;
  return s.images?.[0]?.url ?? s.image?.url ?? s.result?.url ?? out;
}

/** Génère une image et renvoie ses octets (PNG/JPEG). Attente max ~3 min. */
export async function generateHiggsfieldImage(prompt: string, aspectRatio = "1:1"): Promise<{ bytes: Buffer; mime: string }> {
  if (!isHiggsfieldApiConfigured()) throw new Error("HIGGSFIELD_API_KEY absente ou mal formée (attendu « id:secret »).");
  const job = await call<{ request_id?: string; status_url?: string }>(`${BASE}/${MODEL}`, {
    method: "POST",
    body: JSON.stringify({ prompt, aspect_ratio: aspectRatio, resolution: "720p" }),
  });
  const statusUrl = job.status_url ?? (job.request_id ? `${BASE}/requests/${job.request_id}/status` : undefined);
  if (!statusUrl) throw new Error("Higgsfield : aucune requête créée.");

  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const s = await call<Status>(statusUrl);
    const st = (s.status ?? "").toLowerCase();
    if (st === "completed") {
      const url = imageUrlOf(s);
      if (!url) throw new Error("Higgsfield : image terminée mais sans URL.");
      const img = await fetch(url, { cache: "no-store" });
      if (!img.ok) throw new Error(`Higgsfield : téléchargement de l'image impossible (${img.status}).`);
      return { bytes: Buffer.from(await img.arrayBuffer()), mime: img.headers.get("content-type") ?? "image/png" };
    }
    if (st === "failed" || st === "nsfw" || st === "canceled") throw new Error(`Higgsfield : génération « ${st} ».`);
  }
  throw new Error("Higgsfield : délai dépassé (3 min).");
}
