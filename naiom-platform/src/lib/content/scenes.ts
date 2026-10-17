/**
 * Scènes Orbi : une image Higgsfield par slide, où Orbi est mis en scène d'après la
 * direction artistique écrite par Fatou (slide.scene). Les jobs sont lancés en parallèle ;
 * chaque scène terminée passe un contrôle qualité (vision Claude) avant d'être validée.
 *
 * Toutes les images restent hébergées sur Higgsfield — aucune écriture filesystem.
 */
import sharp from "sharp";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { BASE, call, imageUrlOf, type Status } from "@/lib/integrations/higgsfieldApi";
import type { Platform, Slide } from "./generate";
import type { Direction } from "./directions";

const SCENE_MODELS = (process.env.HIGGSFIELD_SCENE_MODELS ?? "marketing-studio/image/flare,marketing-studio/image/sunburst,xai/grok-imagine-image-2.0")
  .split(",").map((x) => x.trim()).filter(Boolean);
const ratioFor = (platform: Platform, single: boolean) => (platform === "instagram" || !single ? "3:4" : "1:1");

export const CHARACTER = `CHARACTER (must match the reference images exactly — both show the same robot, the second one waving with one blade arm raised): "Orbi", a small cute hovering robot drone. Glossy white faceted porcelain shell; a big round head with a dark glass visor showing ONE glowing violet ring eye shaped like planet Saturn's ring; two short pointed fins on top of the head; a small rounded body under the head; two long thin curved blade-like ARMS attached at the sides of the body; a small lime-green thruster glow under the body.
ANATOMY RULES (critical): Orbi has NO legs, NO feet, NO knees, NO shoes, NO hands with fingers. It never stands, sits on legs or walks: it always FLOATS, hovering a little above any surface, with the lime-green glow underneath. Its two long blades are ARMS, used like arms (holding, pointing, waving), never as legs. Only ONE Orbi in the image.`;

const STYLE: Record<string, string> = {
  bureau: "LOOK: premium 3D product render, soft pastel pink seamless studio background, clean white desk or furniture, soft diffused daylight, 50mm lens, shallow depth of field, subtle contact shadows. COMPOSITION: Orbi in the RIGHT half of the frame, its head below the vertical middle; the top-left half is plain empty pastel pink wall (for a title); lower-left corner uncluttered.",
  respira: "LOOK: Pixar-quality cinematic 3D render, lush real-world location, vivid saturated colors, golden-hour sunlight, volumetric light rays, lens flare and light leaks, falling leaves or particles, 35mm lens, depth of field. COMPOSITION: Orbi in the lower half of the frame, slightly left of center, never in the upper half; the upper 40% is calm (foliage, sky) for a giant title.",
  heros: "LOOK: photographic realism, dramatic low-angle hero shot with a 24mm wide lens, bright blue sky with wispy clouds, harsh summer sunlight with crisp shadows and specular highlights on the porcelain. COMPOSITION: Orbi fills the LOWER 60% of the frame, its head below the vertical middle; the upper 45% is open sky for a title.",
  vitrine: "LOOK: black-and-white monochrome still life, architectural studio lighting, deep contrast, glossy sculptural materials (marble, chrome, glass), minimal luxury gallery mood, 85mm lens. COMPOSITION: subject centered in the right half of the frame, generous negative space.",
  vanguard: "LOOK: dark futuristic tech aesthetic, deep black background with subtle violet (#7C3AED) neon accents, geometric angular shapes, holographic HUD elements, sleek metallic surfaces, 35mm lens. COMPOSITION: Orbi centered in the lower half, floating above a reflective dark surface; upper half dark and clean for title text.",
  orbit: "LOOK: cosmic space scene, deep navy-black sky with distant stars and nebula glow, soft violet and blue rim lights, orbital ring paths in the background, 3D render quality, 50mm lens. COMPOSITION: Orbi floating in space in the center-right of the frame; generous empty space in the upper-left for a title.",
  signal: "LOOK: vibrant neon gradient background (violet #7C3AED to pink #C026D3 to orange #FB923C), smooth abstract color flow, clean and modern, no texture, studio lighting on Orbi with soft shadows, 50mm lens. COMPOSITION: Orbi in the lower-right quadrant; upper-left is clean gradient for title text.",
  grille: "LOOK: editorial minimalist design, crisp white background with subtle thin grid lines, clean structured layout, typography-inspired spacing, bright even lighting, 85mm lens. COMPOSITION: Orbi in the right third of the frame; left two-thirds clean white for title text placement.",
  atelier: "LOOK: warm artisan workshop scene, wooden desk with creative tools (pencils, brushes, color swatches), warm amber lighting, shallow depth of field, cozy craft studio mood, 35mm lens. COMPOSITION: Orbi floating above the desk in the center; workspace filling the lower half, upper portion warm and softly lit.",
  cinema: "LOOK: dramatic cinematic lighting, dark moody atmosphere with a single strong spotlight, film noir aesthetic, volumetric light beam, high contrast, 24mm wide lens. COMPOSITION: Orbi spotlit in the center-lower frame; dramatic shadows and light rays around, upper half dark for title.",
  brasier: "LOOK: intense warm scene with deep orange and red ambient glow, ember particles floating, dark background with fire-like volumetric lighting, dramatic contrast, 35mm lens. COMPOSITION: Orbi floating in the center with warm glow illuminating its porcelain shell; dark edges and warm center for visual focus.",
  studio: "LOOK: professional design studio environment, clean desk with a monitor showing abstract UI, soft white and violet ambient lighting, modern minimalist interior, 50mm lens, shallow depth of field. COMPOSITION: Orbi floating near the desk in the right half; left side shows the clean studio environment, upper area clear for title.",
  "plein-air": "LOOK: bright outdoor scene, lush green meadow or garden, clear blue sky, natural sunlight with soft lens flare, vibrant colors, 35mm lens, depth of field with bokeh. COMPOSITION: Orbi floating in the lower-center of the frame above grass; sky and greenery fill the scene, upper area open for title.",
  conversation: "LOOK: social media / messaging aesthetic, soft pastel gradient background (light violet to white), floating chat bubble shapes in the background, clean modern style, 50mm lens. COMPOSITION: Orbi in the center-right, surrounded by subtle floating bubble shapes; clean left side for title.",
};

function referenceUrls(): string[] {
  const base = (process.env.PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!base) throw new Error("PUBLIC_SITE_URL absente : Higgsfield ne peut pas télécharger la référence d'Orbi.");
  return ["orbi-base.png", "orbi-wave.png"].map((f) => `${base}/brand/mascot/${f}`);
}

export function scenePrompt(d: Direction, s: Slide, opts: { fallback?: boolean; fix?: string } = {}): string {
  const action = opts.fallback || !s.scene
    ? `Orbi floats in a simple, elegant setting that evokes the idea: "${s.title}".`
    : s.scene;
  return [
    CHARACTER,
    `SCENE: ${action}`,
    STYLE[d] ?? STYLE["bureau"],
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
    body: JSON.stringify({ prompt: scenePrompt(d, s, opts), image_urls: referenceUrls(), aspect_ratio: ratioFor(platform, single), resolution: "2k" }),
  });
  if (!r.request_id) throw new Error("Higgsfield : aucune requête créée.");
  return r.request_id;
}

export type SceneState = "pending" | "done" | "failed";

/** État d'un job ; s'il est terminé, renvoie l'URL Higgsfield directement (pas de download). */
export async function pollSceneJob(jobId: string): Promise<{ state: SceneState; url?: string; reason?: string }> {
  const s = await call<Status & { error?: unknown }>(`${BASE}/requests/${encodeURIComponent(jobId)}/status`);
  const st = (s.status ?? "").toLowerCase();
  if (st === "completed" || st === "succeeded") {
    const url = imageUrlOf(s);
    if (!url) return { state: "failed", reason: "image absente" };
    return { state: "done", url };
  }
  if (/fail|error|nsfw|cancel/.test(st)) return { state: "failed", reason: `${st} ${typeof s.error === "string" ? s.error : JSON.stringify(s.error ?? "")}` };
  return { state: "pending" };
}

/**
 * Contrôle qualité d'une scène (vision Claude) via URL — aucune écriture disque.
 * Télécharge l'image en mémoire, redimensionne avec sharp, envoie à Claude Vision.
 */
export async function checkScene(imageUrl: string, scene?: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const res = await fetch(imageUrl, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const img = await sharp(buf).resize({ width: 768, withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer();
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
