/**
 * Motion design de Fatou : vidéos courtes façon « clean explainer » (fonds blanc et quasi noir,
 * icônes 3D, typographie grasse centrée, maquette de téléphone). Ici, la partie déterministe :
 * découpage en scènes, longueur de narration, prompts d'images, styles, voix, routage.
 * Les générations passent par l'API Higgsfield du serveur (integrations/higgsfieldVideo.ts) ;
 * le montage final (textes mot par mot, voix, transitions) se fait sur le poste Remotion.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { passerIgHuman } from "./tools.ts";
import type { Langue } from "./config.ts";

/* ---------------- styles ---------------- */
export interface StyleMotion {
  name: string;
  backgrounds: string[];
  accents: string[];
  typography: string;
  elements: string;
  transitions: string;
  pacing: string;
  tension_frame: string;
}

export const STYLE_DEFAUT: StyleMotion = {
  name: "Clean Explainer (dnyxstudios)",
  backgrounds: ["#FFFFFF", "#1A1A1A"],
  accents: ["#A8D8EA", "#F4B8C1", "#B5EAD7", "#FFE5A0"],
  typography: "bold sans-serif, 700+, centered, max 6 words",
  elements: "3D floating icons, rounded corners, soft shadows, phone mockups",
  transitions: "scale + fade, fly-in from edges, word-by-word text reveal",
  pacing: "1.5-3s per scene, fast cuts",
  tension_frame: "black bg, glow text, scanlines optional",
};

const FICHIER_STYLES = "motion-styles.json";

/** Lit motion-styles.json dans le dossier d'état ; le crée avec clean-explainer au premier appel. */
export async function lireStyles(dossier: string): Promise<Record<string, StyleMotion>> {
  const f = path.join(dossier, FICHIER_STYLES);
  try { return JSON.parse(await fs.readFile(f, "utf8")); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    const defaut = { "clean-explainer": STYLE_DEFAUT };
    await fs.mkdir(dossier, { recursive: true });
    await fs.writeFile(f, JSON.stringify(defaut, null, 2), "utf8");
    return defaut;
  }
}

/** Ajoute un style demandé par le propriétaire (identifiant en kebab-case, jamais d'écrasement silencieux). */
export async function ajouterStyle(dossier: string, id: string, style: StyleMotion): Promise<void> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("Identifiant de style : minuscules et tirets (ex. dark-neon).");
  const styles = await lireStyles(dossier);
  if (styles[id]) throw new Error(`Le style ${id} existe déjà.`);
  styles[id] = style;
  await fs.writeFile(path.join(dossier, FICHIER_STYLES), JSON.stringify(styles, null, 2), "utf8");
}

/* ---------------- voix ---------------- */
export interface VoixConfig { voice_id: string; voice_name: string; language: "fr"; style: string; voice_type: "preset" | "element" }

/** Voix préréglées françaises de Higgsfield (list_voices), choisies par le propriétaire. */
export const VOIX_PRESETS_FR = {
  celine: { voice_id: "57ccb351-84d7-54ba-afd4-26b566ca6023", voice_name: "Celine", language: "fr", style: "premium_narrator", voice_type: "preset" },
  elodie: { voice_id: "8b95a259-62fd-545d-b0f0-7b521a972b6b", voice_name: "Elodie", language: "fr", style: "premium_narrator", voice_type: "preset" },
} as const satisfies Record<string, VoixConfig>;

/** Lecture seule de higgsfield-voice.json (null si la voix n'a pas encore été choisie). */
export async function lireVoix(dossier: string): Promise<VoixConfig | null> {
  try { return JSON.parse(await fs.readFile(path.join(dossier, "higgsfield-voice.json"), "utf8")); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
}

/** Relit higgsfield-voice.json ; ne l'écrit qu'au premier passage (jamais recréé ensuite). */
export async function assurerVoix(dossier: string, choix: VoixConfig): Promise<VoixConfig> {
  const f = path.join(dossier, "higgsfield-voice.json");
  try { return JSON.parse(await fs.readFile(f, "utf8")); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    await fs.mkdir(dossier, { recursive: true });
    await fs.writeFile(f, JSON.stringify(choix, null, 2), "utf8");
    return choix;
  }
}

/* ---------------- scènes ---------------- */
export type TypeScene = "HOOK" | "CONTEXT" | "TENSION" | "SOLUTION" | "PROOF" | "CTA";
export type Duree = 15 | 20 | 25 | 30;
export interface Scene { n: number; type: TypeScene; debut: number; fin: number; fond: "white" | "black" }

const GABARITS: Record<Duree, [TypeScene, number][]> = {
  15: [["HOOK", 2], ["TENSION", 4], ["SOLUTION", 6], ["CTA", 3]],
  20: [["HOOK", 2], ["CONTEXT", 4], ["TENSION", 4], ["SOLUTION", 5], ["PROOF", 3], ["CTA", 2]],
  25: [["HOOK", 2], ["CONTEXT", 4], ["TENSION", 4], ["SOLUTION", 7], ["PROOF", 5], ["CTA", 3]],
  30: [["HOOK", 2], ["CONTEXT", 4], ["TENSION", 4], ["SOLUTION", 7], ["PROOF", 5], ["PROOF", 5], ["CTA", 3]],
};
export const FOND: Record<TypeScene, "white" | "black"> = { HOOK: "white", CONTEXT: "white", TENSION: "black", SOLUTION: "white", PROOF: "white", CTA: "black" };

export function decouperScenes(duree: Duree): Scene[] {
  const g = GABARITS[duree];
  if (!g) throw new Error("Durée cible : 15, 20, 25 ou 30 secondes.");
  let t = 0;
  return g.map(([type, d], i) => { const s = { n: i + 1, type, debut: t, fin: t + d, fond: FOND[type] }; t += d; return s; });
}

/* ---------------- narration ---------------- */
const compterMots = (t: string) => t.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

export function verifierLongueur(texte: string, duree: number) {
  const cible = Math.round(duree * 2.5);
  const mots = compterMots(texte);
  return { mots, cible, min: Math.ceil(cible * 0.8), max: Math.floor(cible * 1.2), ok: mots >= cible * 0.8 && mots <= cible * 1.2 };
}

/** Longueur + passage ig-human (score ≥ 70 exigé). Renvoie aussi le texte nettoyé. */
export async function verifierNarration(texte: string, duree: number, lang: Langue) {
  const longueur = verifierLongueur(texte, duree);
  const h = await passerIgHuman(texte, lang);
  return { longueur, texte: h.text.trim(), human_score: h.human_score, verdict: h.verdict, fiabilite: h.fiabilite, ok: longueur.ok && h.human_score >= 70 };
}

/* ---------------- prompts ---------------- */
const MOTS_MAX = 6;
export function verifierTexteEcran(t: string): void {
  if (compterMots(t) > MOTS_MAX) throw new Error(`Texte à l'écran « ${t} » : ${MOTS_MAX} mots maximum.`);
}

const ACCENTS = "soft blue, soft pink, soft green and warm yellow pastel accents on UI elements only";
const FIN = "minimal, clean motion design style, vertical 9:16 frame, 4K";

/** Prompt d'image clé d'une scène. Le fond est toujours blanc ou noir (règle du style). */
export function promptImage(scene: Scene, texteEcran: string, style: StyleMotion): string {
  verifierTexteEcran(texteEcran);
  const t = texteEcran.replace(/["\n]/g, " ").trim();
  switch (scene.type) {
    case "HOOK":
      return `clean white background, bold black sans-serif text '${t}' centered, generous empty space, ${FIN}`;
    case "CONTEXT":
      return `clean white background, 3D floating app icons and UI cards with soft shadows and rounded corners, slight rotation, depth of field, ${ACCENTS}, ${style.elements}, ${FIN}`;
    case "TENSION":
      return `black background, glowing white sans-serif text '${t}', subtle scanline effect, cinematic, motion design, vertical 9:16 frame, 4K`;
    case "SOLUTION":
      return `clean white background, iPhone 15 Pro mockup floating center frame, surrounded by orbiting 3D app icons, pastel UI cards sliding in, soft shadows, depth of field, ${ACCENTS}, ${FIN}`;
    case "PROOF":
      return `clean white background, close-up of one floating UI card showing the result: ${t}, rounded corners, soft shadow, ${ACCENTS}, ${FIN}`;
    case "CTA":
      return `black background, glowing white bold sans-serif text '${t}' centered, soft glow, premium, motion design, vertical 9:16 frame, 4K`;
  }
}

/** Mouvement demandé à l'animation d'une image clé (jamais de nouveaux éléments). */
export function promptAnimation(scene: Scene): string {
  const base = "keep the exact composition and colors of the image, no new objects, no text changes";
  const mouvement: Record<TypeScene, string> = {
    HOOK: "the text scales in smoothly, slight zoom",
    CONTEXT: "icons and cards float in from the edges and rotate slightly, gentle parallax",
    TENSION: "subtle glitch flicker on the glowing text, scanlines drift",
    SOLUTION: "icons orbit slowly around the phone, cards slide in with a soft bounce",
    PROOF: "slow push-in on the card, soft focus pull",
    CTA: "the glowing text fades in and breathes softly",
  };
  return `${mouvement[scene.type]}, smooth scale and fade, ${base}`;
}

/** Contrôle qu'un prompt d'image garde le style : fond blanc/noir + « motion design ». */
export function promptRespecteStyle(p: string): boolean {
  return /(white|black) background/i.test(p) && /motion design/i.test(p) && !/\b(?:blue|pink|green|yellow|red|purple|gradient|colou?red) background/i.test(p);
}

/* ---------------- brief ---------------- */
export interface BriefVideo {
  sujet: string;
  accroches: { formula_id: number; texte: string; score: number }[];
  points: string[];
  cta: string;
  duree: Duree;
}
export function validerBrief(b: BriefVideo): string[] {
  const e: string[] = [];
  if (!b.sujet?.trim()) e.push("sujet manquant");
  if (b.accroches.length !== 3) e.push("il faut 3 accroches");
  if (new Set(b.accroches.map((a) => a.formula_id)).size !== b.accroches.length) e.push("3 formules différentes de hooks.json");
  if (b.accroches.some((a) => !Number.isFinite(a.score))) e.push("chaque accroche doit être notée par hookscore");
  if (b.points.length < 3 || b.points.length > 5) e.push("3 à 5 points clés");
  if (!b.cta?.trim()) e.push("CTA manquant");
  if (![15, 20, 25, 30].includes(b.duree)) e.push("durée : 15, 20, 25 ou 30 s");
  return e;
}

/* ---------------- routage vidéo ---------------- */
export type DemandeVideo = "refus" | "reel-video" | "story-video" | "idea-to-video" | "motion-video";
export const REFUS_VIDEO_AUTRUI = "Je ne réutilise pas la vidéo de quelqu'un d'autre : je te génère une vidéo originale sur le même sujet, avec tes mots et ton style.";

const RE: [DemandeVideo, RegExp][] = [
  ["refus", /(?:vidéo|video|reel|contenu)s? (?:de|d')\s*(?:quelqu'un d'autre|un autre compte|autrui|ce créateur)|(?:reprends|récupère|télécharge|repost[e]?|réutilise) (?:sa|la|cette|leur) vidéo|someone else'?s video|reupload/iu],
  ["reel-video", /reel vidéo|vidéo \+ reel|reel \+ vidéo|vidéo avec (?:sa |une |la )?légende|reel et (?:une )?vidéo|vidéo et (?:un )?reel/iu],
  ["story-video", /story vidéo|vidéo en story/iu],
  ["idea-to-video", /idée de vidéo|vidéo à partir de (?:cette|mon|ton) idée|idea to video|video from this idea|vidéo sur |vidéo qui (?:explique|montre)/iu],
  ["motion-video", /motion design|(?:fais|crée|créer|faire)(?:-moi)? une vidéo|make a video|video about/iu],
];
export function detecterVideo(demande: string): DemandeVideo | null {
  for (const [type, re] of RE) if (re.test(demande)) return type;
  return null;
}

/** Consignes de pipeline injectées dans le contexte de Fatou (le modèle les suit tel quel). */
export function consignesPipeline(type: Exclude<DemandeVideo, "refus">, styles: Record<string, StyleMotion>, voix: VoixConfig | null): string {
  const brief = type === "motion-video"
    ? "Pose UNE seule question groupée si des éléments manquent : sujet, accroche (ou 3 options), 3 à 5 points clés, CTA, durée (15, 20, 25 ou 30 s ; 20 par défaut)."
    : "Développe l'idée en brief complet : sujet, angle, public, 3 accroches de 3 formules différentes de hooks.json notées avec hookscore, 3 à 5 points clés concrets, CTA tiré de voice.md et plan.md, durée selon la complexité (astuce 15 s, explication 20-25 s, histoire 30 s). Montre le brief et attends son « ok » ou ses corrections avant toute génération.";
  const story = type === "story-video" ? "\nStory vidéo : durée 15 s, verticale, puis écris les frames de Stories autour (ig-story)." : "";
  return `# Pipeline motion design (${type})
${brief}${story}
1. Appelle plan_video_motion (durée + textes à l'écran de 6 mots maximum) : il rend les scènes, les timecodes et les prompts d'images.
2. Écris la narration en français, une phrase par scène, environ 2,5 mots par seconde. Écris les chiffres en chiffres (ceux du propriétaire uniquement, sinon {{your number}}) et varie la longueur des phrases. Appelle verifier_narration : score ig-human ≥ 70 exigé, sinon réécris.
3. Montre le plan (scènes, narration, prompts, nombre d'images et de clips à payer) et attends son « oui ».
4. Après le « oui » : generer_image_cle pour chaque scène (prompts de plan_video_motion, tels quels), puis animer_scene sur chaque image, puis statut_video jusqu'à « completed ».
5. Narration audio : voix ${voix ? `${voix.voice_name} (${voix.voice_id})` : "non choisie (Celine ou Elodie : demande au propriétaire)"}. L'API du serveur ne fait pas de synthèse vocale : dis-le, et propose soit que le propriétaire enregistre la narration, soit de la générer depuis la session Claude Code.
6. Montage : quand tous les clips sont « completed », appelle assembler_video avec leurs request_id dans l'ordre des scènes ; il rend le lien de la vidéo finale (image seule). La narration enregistrée et les textes mot par mot peuvent ensuite être ajoutés sur le poste Remotion (studio vidéo). Termine par le bloc MOTION VIDEO READY (durée, scènes avec timecodes, narration, voix, style, score ig-human, request_id Higgsfield).
Style actif : clean-explainer. Styles disponibles : ${Object.keys(styles).join(", ")}. Jamais de vidéo ou d'image externe : tout est généré.`;
}
