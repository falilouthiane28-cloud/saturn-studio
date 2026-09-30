/**
 * Motion design de Fatou : vidéos courtes façon SaaS / explainer (références : dnyxstudios, Hera,
 * Claude). Ici, la partie déterministe : scènes, narration, styles, prompts d'images, voix, routage.
 * Les images Higgsfield ne contiennent jamais de texte : titres, mot accentué et logo sont posés
 * au montage (montageMotion.ts), avec une vraie typographie. Générations : integrations/higgsfieldVideo.ts.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { passerIgHuman } from "./tools.ts";
import type { Langue } from "./config.ts";

/* ---------------- scènes et formats ---------------- */
export type TypeScene = "HOOK" | "CONTEXT" | "TENSION" | "SOLUTION" | "PROOF" | "UI" | "CTA" | "LOGO";
export type Duree = 15 | 20 | 25 | 30;
export type FormatVideo = "9:16" | "16:9";
export type Ton = "clair" | "sombre" | "marque";
export interface Scene { n: number; type: TypeScene; debut: number; fin: number; fond: "white" | "black" }

/** Fond de référence d'une scène (style clean-explainer) : sert au storyboard et aux tests. */
export const FOND: Record<TypeScene, "white" | "black"> = {
  HOOK: "white", CONTEXT: "white", TENSION: "black", SOLUTION: "white", PROOF: "white", UI: "white", CTA: "black", LOGO: "black",
};

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
  /** Couleur du mot accentué et du halo du logo (titres posés au montage). */
  accent?: string;
  /** Réglages des prompts d'images (absents pour un style créé à la main : repli générique). */
  prompts?: { fonds: Record<Ton, string>; tons: Partial<Record<TypeScene, Ton>>; ambiance: string; objets: string };
}

const VIOLET_SATURN = "#7C3AED";

export const STYLES_INTEGRES: Record<string, StyleMotion> = {
  "clean-explainer": {
    name: "Clean Explainer (dnyxstudios)",
    backgrounds: ["#FFFFFF", "#1A1A1A"],
    accents: ["#A8D8EA", "#F4B8C1", "#B5EAD7", "#FFE5A0"],
    typography: "bold sans-serif, 700+, centered, max 6 words, one accented word",
    elements: "3D floating icons, rounded corners, soft shadows, phone mockups",
    transitions: "continuous camera moves, scale + fade, fly-in from edges",
    pacing: "few hard cuts, 3-6 s per scene with camera motion",
    tension_frame: "black bg, glow, scanlines optional",
    accent: VIOLET_SATURN,
    prompts: {
      fonds: { clair: "clean white background", sombre: "black background", marque: "black background" },
      tons: { TENSION: "sombre", CTA: "sombre", LOGO: "sombre" },
      ambiance: "soft blue, soft pink, soft green and warm yellow pastel accents on UI elements only",
      objets: "3D app-style icons with rounded corners and subtle shadows",
    },
  },
  "lancement-saas": {
    name: "Lancement SaaS (Hera)",
    backgrounds: ["warm dark gradient", "#FFFFFF", "brand color"],
    accents: [VIOLET_SATURN],
    typography: "bold sans-serif, typed with a cursor, one accented word",
    elements: "UI input boxes, style chips, voice recorder card, full-frame brand color sweep",
    transitions: "continuous camera moves, brand color takeover, soft blur",
    pacing: "1 to 3 hard cuts in 20 s",
    tension_frame: "dark card with waveform",
    accent: VIOLET_SATURN,
    prompts: {
      fonds: {
        clair: "soft off-white background with a faint warm glow at the edges",
        sombre: "deep warm dark gradient background, black fading to glowing orange at the bottom",
        marque: "full-frame vivid violet gradient background (#7C3AED), smooth light sweep",
      },
      tons: { HOOK: "sombre", TENSION: "sombre", CTA: "marque", LOGO: "marque" },
      ambiance: "premium SaaS launch look, soft bloom, subtle film grain",
      objets: "clean rounded UI panels and chips with soft shadows",
    },
  },
  "produit-3d": {
    name: "Produit 3D sombre",
    backgrounds: ["#0E0E10"],
    accents: ["glowing orange", VIOLET_SATURN],
    typography: "bold sans-serif, white with soft glow",
    elements: "dark glass cards with glowing edges, floating 3D cubes, app dock",
    transitions: "slow orbiting camera, glow blooms",
    pacing: "2 to 4 hard cuts in 20 s",
    tension_frame: "dark glass card with glowing border",
    accent: "#F59E0B",
    prompts: {
      fonds: {
        clair: "dark charcoal background with a soft warm spotlight",
        sombre: "near-black background with soft volumetric light",
        marque: "near-black background with a warm orange and violet glow in the center",
      },
      tons: { HOOK: "sombre", CONTEXT: "sombre", TENSION: "sombre", SOLUTION: "clair", PROOF: "clair", UI: "sombre", CTA: "marque", LOGO: "marque" },
      ambiance: "cinematic product render, glossy dark glass, glowing edges, shallow depth of field",
      objets: "floating matte 3D cubes and a dock of rounded app icons",
    },
  },
  "degrade-doux": {
    name: "Dégradé doux (Claude)",
    backgrounds: ["soft light gradient"],
    accents: ["#D97757", VIOLET_SATURN],
    typography: "medium-bold sans-serif, one accented word in brand color",
    elements: "interfaces in 3D perspective under dark glass, checklists, product pills",
    transitions: "long continuous camera moves, slow zooms",
    pacing: "1 or 2 hard cuts in 25 s",
    tension_frame: "tilted screen with dark glass bezel",
    accent: VIOLET_SATURN,
    prompts: {
      fonds: {
        clair: "very soft light gradient background, white to pale peach and lavender",
        sombre: "dark glass frame over a warm peach and violet gradient background",
        marque: "soft violet to peach gradient background, gentle glow",
      },
      tons: { UI: "sombre", CTA: "marque", LOGO: "marque" },
      ambiance: "calm premium tech look, airy, soft shadows",
      objets: "rounded interface panels and pill-shaped chips",
    },
  },
};

/** Style par défaut (compatibilité : l'ancien nom reste exporté). */
export const STYLE_DEFAUT = STYLES_INTEGRES["clean-explainer"];

const FICHIER_STYLES = "motion-styles.json";

/**
 * Styles disponibles : ceux créés par le propriétaire (motion-styles.json) + les styles intégrés,
 * toujours à jour depuis le code. Le fichier est créé au premier appel.
 */
export async function lireStyles(dossier: string): Promise<Record<string, StyleMotion>> {
  const f = path.join(dossier, FICHIER_STYLES);
  let perso: Record<string, StyleMotion> = {};
  try { perso = JSON.parse(await fs.readFile(f, "utf8")); }
  catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    await fs.mkdir(dossier, { recursive: true });
    await fs.writeFile(f, JSON.stringify(STYLES_INTEGRES, null, 2), "utf8");
  }
  return { ...perso, ...STYLES_INTEGRES };
}

/** Ajoute un style demandé par le propriétaire (identifiant en kebab-case, jamais d'écrasement). */
export async function ajouterStyle(dossier: string, id: string, style: StyleMotion): Promise<void> {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error("Identifiant de style : minuscules et tirets (ex. dark-neon).");
  const styles = await lireStyles(dossier);
  if (styles[id]) throw new Error(`Le style ${id} existe déjà.`);
  const f = path.join(dossier, FICHIER_STYLES);
  const perso = JSON.parse(await fs.readFile(f, "utf8")) as Record<string, StyleMotion>;
  perso[id] = style;
  await fs.writeFile(f, JSON.stringify(perso, null, 2), "utf8");
}

/** Ton d'une scène dans un style (clair, sombre ou couleur de marque). */
export function tonScene(type: TypeScene, style: StyleMotion): Ton {
  return style.prompts?.tons[type] ?? (FOND[type] === "black" ? "sombre" : "clair");
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

/* ---------------- découpage standard ---------------- */
const GABARITS: Record<Duree, [TypeScene, number][]> = {
  15: [["HOOK", 2], ["TENSION", 4], ["SOLUTION", 6], ["CTA", 3]],
  20: [["HOOK", 2], ["CONTEXT", 4], ["TENSION", 4], ["SOLUTION", 5], ["PROOF", 3], ["CTA", 2]],
  25: [["HOOK", 2], ["CONTEXT", 4], ["TENSION", 4], ["SOLUTION", 7], ["PROOF", 5], ["CTA", 3]],
  30: [["HOOK", 2], ["CONTEXT", 4], ["TENSION", 4], ["SOLUTION", 7], ["PROOF", 5], ["PROOF", 5], ["CTA", 3]],
};

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

/* ---------------- texte à l'écran ---------------- */
const MOTS_MAX = 6;

/** Découpe « progress *slows* » en segments ; un seul mot accentué autorisé. */
export function segmentsTitre(t: string): { texte: string; accent: boolean }[] {
  const morceaux = t.split(/(\*[^*]+\*)/).filter(Boolean);
  return morceaux.map((m) => (m.startsWith("*") && m.endsWith("*") ? { texte: m.slice(1, -1), accent: true } : { texte: m, accent: false }));
}

export function verifierTexteEcran(t: string): void {
  const brut = t.replace(/\*/g, "");
  if (compterMots(brut) > MOTS_MAX) throw new Error(`Texte à l'écran « ${brut} » : ${MOTS_MAX} mots maximum.`);
  if (segmentsTitre(t).filter((s) => s.accent).length > 1) throw new Error(`Texte à l'écran « ${brut} » : un seul mot accentué.`);
}

/* ---------------- prompts ---------------- */
const SUJET: Record<TypeScene, string> = {
  HOOK: "large empty centered area reserved for a bold title, subtle depth and soft light",
  CONTEXT: "3D floating app icons and UI cards with soft shadows and rounded corners, slight rotation, depth of field",
  TENSION: "tense cinematic mood, subtle glow and scanlines, empty center reserved for a title",
  SOLUTION: "smartphone mockup floating center frame, orbiting 3D app icons, rounded UI cards sliding in, depth of field",
  PROOF: "close-up of one floating rounded UI card showing a checklist and a result chart, soft focus background",
  UI: "clean software interface mockup in slight 3D perspective: a rounded input box with a blinking cursor, floating panels and chips, soft shadows, no readable text",
  CTA: "minimal frame with soft glow, empty center reserved for a call to action",
  LOGO: "minimal end frame, soft glow blooming in the center, empty space reserved for a brand logo",
};

/** Prompt d'image clé d'une scène : fond selon le ton du style, jamais de texte dans l'image. */
export function promptImage(scene: Scene, texteEcran: string, style: StyleMotion, format: FormatVideo = "9:16"): string {
  verifierTexteEcran(texteEcran);
  const ton = tonScene(scene.type, style);
  const fond = style.prompts?.fonds[ton] ?? (ton === "clair" ? "clean white background" : "black background");
  const objets = style.prompts?.objets ?? style.elements;
  const ambiance = style.prompts?.ambiance ?? style.accents.join(", ");
  const cadre = format === "16:9" ? "horizontal 16:9 frame" : "vertical 9:16 frame";
  return `${fond}, ${SUJET[scene.type]}, ${objets}, ${ambiance}, no text, no letters, no logos, clean motion design style, ${cadre}, 4K`;
}

/** Mouvement demandé à l'animation (mouvement de caméra continu, jamais de nouveaux éléments). */
export function promptAnimation(scene: Scene): string {
  const base = "keep the exact composition and colors of the image, no new objects, no text, continuous smooth camera move, no hard cut";
  const mouvement: Record<TypeScene, string> = {
    HOOK: "slow push-in, soft light drifts across the frame",
    CONTEXT: "icons and cards float in from the edges and rotate slightly, gentle parallax",
    TENSION: "subtle glitch flicker in the glow, scanlines drift",
    SOLUTION: "icons orbit slowly around the phone, cards slide in with a soft bounce",
    PROOF: "slow push-in on the card, soft focus pull",
    UI: "slow camera glide around the interface in 3D perspective, panels slide in with soft easing",
    CTA: "the glow breathes softly, gentle camera settle",
    LOGO: "a soft glow blooms from the center, the camera settles, calm end",
  };
  return `${mouvement[scene.type]}, ${base}`;
}

/** Contrôle qu'un prompt d'image suit la règle : un fond, « motion design », aucun texte. */
export function promptRespecteStyle(p: string): boolean {
  return /background/i.test(p) && /motion design/i.test(p) && /no text/i.test(p);
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
    ? "Pose UNE seule question groupée si des éléments manquent : sujet, accroche (ou 3 options), 3 à 5 points clés, CTA, durée (15, 20, 25 ou 30 s ; 20 par défaut), format (9:16 ou 16:9)."
    : "Développe l'idée en brief complet : sujet, angle, public, 3 accroches de 3 formules différentes de hooks.json notées avec hookscore, 3 à 5 points clés concrets, CTA tiré de voice.md et plan.md, durée selon la complexité (astuce 15 s, explication 20-25 s, histoire 30 s). Montre le brief et attends son « ok » ou ses corrections avant toute génération.";
  const story = type === "story-video" ? "\nStory vidéo : durée 15 s, verticale, puis écris les frames de Stories autour (ig-story)." : "";
  return `# Pipeline motion design (${type})
${brief}${story}
Le plus simple pour le propriétaire : l'onglet Motion du studio (idée + template → plan → génération → montage automatique avec titres). Propose-le s'il préfère cliquer.
1. Appelle plan_video_motion (durée + textes à l'écran de 6 mots maximum, un seul mot accentué entre *astérisques*) : il rend les scènes, les timecodes et les prompts d'images.
2. Écris la narration en français, une phrase par scène, environ 2,5 mots par seconde. Écris les chiffres en chiffres (ceux du propriétaire uniquement, sinon {{your number}}) et varie la longueur des phrases. Appelle verifier_narration : score ig-human ≥ 70 exigé, sinon réécris.
3. Montre le plan (scènes, narration, prompts, nombre d'images et de clips à payer) et attends son « oui ».
4. Après le « oui » : generer_image_cle pour chaque scène (prompts de plan_video_motion, tels quels : jamais de texte dans l'image), puis animer_scene sur chaque image, puis statut_video jusqu'à « completed ».
5. Narration audio : voix ${voix ? `${voix.voice_name} (${voix.voice_id})` : "non choisie (Celine ou Elodie : demande au propriétaire)"}. L'API du serveur ne fait pas de synthèse vocale : dis-le, et propose soit que le propriétaire enregistre la narration, soit de la générer depuis la session Claude Code.
6. Montage : quand tous les clips sont « completed », appelle assembler_video avec leurs request_id dans l'ordre des scènes ; il rend le lien de la vidéo finale (image seule, sans titres depuis le chat). Termine par le bloc MOTION VIDEO READY (durée, scènes avec timecodes, narration, voix, style, score ig-human, request_id Higgsfield).
Styles disponibles : ${Object.keys(styles).join(", ")} (clean-explainer par défaut). Jamais de vidéo ou d'image externe : tout est généré.`;
}
