/**
 * Scènes Orbi : une image Higgsfield par slide, où Orbi est mis en scène d'après la
 * direction artistique écrite par Léa (slide.scene). Les jobs sont lancés en parallèle ;
 * chaque scène terminée passe un contrôle qualité (vision Claude) avant d'être composée.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { BASE, call, imageUrlOf, type Status } from "@/lib/integrations/higgsfieldApi";
import type { Platform, Slide } from "./generate";
import type { Direction } from "./directions";

/**
 * Modèles d'édition à référence, par ordre de préférence (HIGGSFIELD_SCENE_MODELS, séparés
 * par des virgules). Une relance passe au modèle suivant : utile quand l'un est indisponible.
 */
const SCENE_MODELS = (process.env.HIGGSFIELD_SCENE_MODELS ?? process.env.HIGGSFIELD_EDIT_MODEL ?? "alibaba/qwen-image-3/edit")
  .split(",").map((x) => x.trim()).filter(Boolean);
/** Qwen n'accepte pas le 4:5 (on recadre ensuite) ; les autres modèles le gèrent nativement. */
const ratioFor = (model: string, platform: Platform, single: boolean) =>
  platform === "instagram" || !single ? (/qwen/.test(model) ? "3:4" : "4:5") : "1:1";

const SCENE_DIR = path.join(process.cwd(), "public", "content-out");

/** Verrou de personnage : Orbi identique à la référence, et surtout SANS jambes (il flotte). */
export const CHARACTER = `CHARACTER (must match the reference images exactly — both show the same robot, the second one waving with one blade arm raised): "Orbi", a small cute hovering robot drone. Glossy white faceted porcelain shell; a big round head with a dark glass visor showing ONE glowing violet ring eye shaped like planet Saturn's ring; two short pointed fins on top of the head; a small rounded body under the head; two long thin curved blade-like ARMS attached at the sides of the body; a small lime-green thruster glow under the body.
ANATOMY RULES (critical): Orbi has NO legs, NO feet, NO knees, NO shoes, NO hands with fingers. It never stands, sits on legs or walks: it always FLOATS, hovering a little above any surface, with the lime-green glow underneath. Its two long blades are ARMS, used like arms (holding, pointing, waving), never as legs. Only ONE Orbi in the image.`;

/** Style propre à chaque direction à scènes (ambiance, lumière, cadrage, place pour le texte). */
const STYLE: Record<string, string> = {
  bureau: "LOOK: premium 3D product render, soft pastel pink seamless studio background, clean white desk or furniture, soft diffused daylight, 50mm lens, shallow depth of field, subtle contact shadows. COMPOSITION: Orbi in the RIGHT half of the frame, its head below the vertical middle; the top-left half is plain empty pastel pink wall (for a title); lower-left corner uncluttered.",
  respira: "LOOK: Pixar-quality cinematic 3D render, lush real-world location, vivid saturated colors, golden-hour sunlight, volumetric light rays, lens flare and light leaks, falling leaves or particles, 35mm lens, depth of field. COMPOSITION: Orbi in the lower half of the frame, slightly left of center, never in the upper half; the upper 40% is calm (foliage, sky) for a giant title.",
  heros: "LOOK: photographic realism, dramatic low-angle hero shot with a 24mm wide lens, bright blue sky with wispy clouds, harsh summer sunlight with crisp shadows and specular highlights on the porcelain. COMPOSITION: Orbi fills the LOWER 60% of the frame, its head below the vertical middle; the upper 45% is open sky for a title.",
  vitrine: "LOOK: black-and-white monochrome still life, architectural studio lighting, deep contrast, glossy sculptural materials (marble, chrome, glass), minimal luxury gallery mood, 85mm lens. COMPOSITION: subject centered in the right half of the frame, generous negative space.",
};

/**
 * Références d'Orbi envoyées au modèle. Seule, la vue de face (lames pendantes) est lue comme
 * « deux jambes » ; la pose où il salue, bras levé, montre que les lames sont des bras.
 */
function referenceUrls(): string[] {
  const base = (process.env.PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!base) throw new Error("PUBLIC_SITE_URL absente : Higgsfield ne peut pas télécharger la référence d'Orbi.");
  return ["orbi-base.png", "orbi-wave.png"].map((f) => `${base}/brand/mascot/${f}`);
}

/** Prompt complet : personnage verrouillé + scène de Léa + style de la direction + correctif éventuel du contrôle qualité. */
export function scenePrompt(d: Direction, s: Slide, opts: { fallback?: boolean; fix?: string } = {}): string {
  const action = opts.fallback || !s.scene
    ? `Orbi floats in a simple, elegant setting that evokes the idea: "${s.title}".`
    : s.scene;
  return [
    CHARACTER,
    `SCENE: ${action}`,
    STYLE[d] ?? "",
    opts.fix ? `FIX FROM PREVIOUS ATTEMPT (mandatory): ${opts.fix}` : "",
    "No text, no letters, no numbers, no words, no logos, no watermark anywhere in the image.",
  ].filter(Boolean).join("\n");
}

export async function createSceneJob(
  d: Direction, platform: Platform, s: Slide, single: boolean, opts: { attempt?: number; fallback?: boolean; fix?: string } = {}
): Promise<string> {
  const model = SCENE_MODELS[(opts.attempt ?? 0) % SCENE_MODELS.length];
  const r = await call<{ request_id?: string }>(`${BASE}/${model}`, {
    method: "POST",
    body: JSON.stringify({ prompt: scenePrompt(d, s, opts), image_urls: referenceUrls(), aspect_ratio: ratioFor(model, platform, single), resolution: "2k" }),
  });
  if (!r.request_id) throw new Error("Higgsfield : aucune requête créée.");
  return r.request_id;
}

export type SceneState = "pending" | "done" | "failed";

/** État d'un job ; s'il est terminé, l'image est enregistrée et son chemin disque renvoyé. */
export async function pollSceneJob(jobId: string, postId: string, index: number): Promise<{ state: SceneState; file?: string; reason?: string }> {
  const s = await call<Status & { error?: unknown }>(`${BASE}/requests/${encodeURIComponent(jobId)}/status`);
  const st = (s.status ?? "").toLowerCase();
  if (st === "completed" || st === "succeeded") {
    const url = imageUrlOf(s);
    if (!url) return { state: "failed", reason: "image absente" };
    // Téléchargement raté = incident réseau passager : on réessaiera au prochain passage.
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Téléchargement de la scène impossible (${res.status}).`);
    await fs.mkdir(SCENE_DIR, { recursive: true });
    const file = path.join(SCENE_DIR, `${postId}-scene-${index}.png`);
    await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
    return { state: "done", file };
  }
  if (/fail|error|nsfw|cancel/.test(st)) return { state: "failed", reason: `${st} ${typeof s.error === "string" ? s.error : JSON.stringify(s.error ?? "")}` };
  return { state: "pending" };
}

/**
 * Contrôle qualité d'une scène (vision Claude) : Orbi doit être fidèle et sans jambes,
 * l'image sans texte parasite ni déformation. Renvoie le correctif à injecter dans le
 * prompt de la relance, ou null si la scène est validée. En cas d'indisponibilité du
 * contrôle, la scène est acceptée (on ne bloque pas la production).
 */
export async function checkScene(file: string, scene?: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const img = await sharp(file).resize({ width: 768, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { text } = await generateText({
      model: anthropic("claude-sonnet-5"),
      maxOutputTokens: 300,
      messages: [{
        role: "user",
        content: [
          { type: "image", image: img, mediaType: "image/jpeg" },
          { type: "text", text: `You are a strict art director reviewing an AI-generated image of our mascot "Orbi".
Orbi is a small white porcelain hovering robot: big round head, dark visor with ONE violet ring eye, two short fins on the head, two long thin blade ARMS, lime-green glow under the body. Orbi has NO legs and NO feet: it floats.
Intended scene: ${scene ?? "(free)"}
Reject the image if ANY of these is true: Orbi has legs, feet, knees or shoes, or stands/walks on its blades like legs; Orbi's head, visor or ring eye is clearly different from the description; there are two or more Orbis; the robot is malformed (melted, broken, extra limbs, fused with objects); readable text, letters or logos appear; the image is blurry or low quality.
Answer ONLY with JSON: {"ok": true} or {"ok": false, "fix": "one short English instruction telling the image model what to correct"}.` },
        ],
      }],
    });
    const j = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")) as { ok?: boolean; fix?: string };
    return j.ok === false ? (j.fix || "Orbi must float with no legs and no feet, matching the reference exactly.") : null;
  } catch {
    return null;
  }
}
