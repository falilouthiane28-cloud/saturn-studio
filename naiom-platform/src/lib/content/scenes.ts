/**
 * Scènes Orbi : une image Higgsfield par slide, où Orbi est mis en scène d'après la
 * direction artistique écrite par Léa (slide.scene). Les jobs sont lancés en parallèle ;
 * chaque scène terminée est téléchargée puis composée avec la typo (directions.ts).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { BASE, call, imageUrlOf, type Status } from "@/lib/integrations/higgsfieldApi";
import type { Platform, Slide } from "./generate";
import type { Direction } from "./directions";

const EDIT_MODEL = process.env.HIGGSFIELD_EDIT_MODEL ?? "alibaba/qwen-image-3/edit";
const SCENE_DIR = path.join(process.cwd(), "public", "content-out");

/** Verrou de personnage : Higgsfield doit garder Orbi identique à la référence. */
const KEEP =
  "Keep EXACTLY the same robot character as in the reference image: white glossy faceted porcelain armor, round dark glass visor with ONE glowing violet Saturn-ring eye (a luminous ring crossed by a thin tilted orbit), two short pointed fins on the head, long thin blade-like arms, small lime-green thruster light under the body. Same proportions, same materials, cute and small.";

/** Style propre à chaque direction à scènes (ambiance, lumière, cadrage, place pour le texte). */
const STYLE: Record<string, string> = {
  bureau: "Soft pastel pink seamless studio background, clean white desk or furniture, soft daylight, photorealistic premium 3D render, shallow depth of field. Compose the robot in the RIGHT half of the frame, its head below the vertical middle. Keep the top-left half of the frame as plain empty pastel pink wall (for a title) and the lower-left corner uncluttered.",
  respira: "Pixar-quality cinematic 3D render, lush nature or cozy real-world location, vivid saturated colors, sunny golden light, lens flare and light leaks, falling leaves or particles, depth of field. Place the robot in the lower half of the frame, slightly off-center to the LEFT, never in the upper half. Keep the upper 40% of the frame visually calm (foliage, sky) for a giant title.",
  heros: "Dramatic low-angle hero shot, bright blue sky with wispy clouds, harsh summer sunlight, photographic realism, dynamic pose close to camera. The robot fills the LOWER 60% of the frame, its head below the vertical middle. Keep the upper 45% of the frame as open sky for a title.",
  vitrine: "Black-and-white monochrome still life, architectural studio lighting, strong contrast, glossy sculptural look, minimal premium composition, subject centered on the right half.",
};

const RATIO = (platform: Platform, single: boolean) => (platform === "instagram" || !single ? "3:4" : "1:1");

function referenceUrl(): string {
  const base = (process.env.PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!base) throw new Error("PUBLIC_SITE_URL absente : Higgsfield ne peut pas télécharger la référence d'Orbi.");
  return `${base}/brand/mascot/orbi-base.png`;
}

export function scenePrompt(d: Direction, s: Slide, fallback = false): string {
  const action = fallback || !s.scene
    ? `The robot stands in a simple, elegant setting that evokes the idea: "${s.title}".`
    : s.scene;
  return `${KEEP} ${action} ${STYLE[d] ?? ""} No text, no letters, no words, no logos, no watermark.`;
}

export async function createSceneJob(d: Direction, platform: Platform, s: Slide, single: boolean, fallback = false): Promise<string> {
  const r = await call<{ request_id?: string }>(`${BASE}/${EDIT_MODEL}`, {
    method: "POST",
    body: JSON.stringify({ prompt: scenePrompt(d, s, fallback), image_urls: [referenceUrl()], aspect_ratio: RATIO(platform, single), resolution: "2k" }),
  });
  if (!r.request_id) throw new Error("Higgsfield : aucune requête créée.");
  return r.request_id;
}

export type SceneState = "pending" | "done" | "failed";

/** État d'un job ; s'il est terminé, l'image est enregistrée et son chemin disque renvoyé. */
export async function pollSceneJob(jobId: string, postId: string, index: number): Promise<{ state: SceneState; file?: string }> {
  const s = await call<Status>(`${BASE}/requests/${encodeURIComponent(jobId)}/status`);
  const st = (s.status ?? "").toLowerCase();
  if (st === "completed" || st === "succeeded") {
    const url = imageUrlOf(s);
    if (!url) return { state: "failed" };
    // Téléchargement raté = incident réseau passager : on réessaiera au prochain passage.
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Téléchargement de la scène impossible (${res.status}).`);
    await fs.mkdir(SCENE_DIR, { recursive: true });
    const file = path.join(SCENE_DIR, `${postId}-scene-${index}.png`);
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
    return { state: "done", file };
  }
  if (/fail|error|nsfw|cancel/.test(st)) return { state: "failed" };
  return { state: "pending" };
}
