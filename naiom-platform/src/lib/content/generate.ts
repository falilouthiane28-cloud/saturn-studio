/**
 * Génération de contenu structuré par plateforme (agent Fatou — createur-contenu).
 * Instagram / LinkedIn / Twitter(X). Claude renvoie un JSON adapté au réseau,
 * ensuite affiché dans un aperçu qui imite le rendu réel du réseau.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";

export type Platform = "instagram" | "linkedin" | "twitter";
export type Format =
  | "carousel" // IG + LinkedIn
  | "post" // IG (image + caption) / LinkedIn (texte)
  | "image" // LinkedIn image + texte accroche
  | "tweet" // Twitter simple
  | "thread"; // Twitter thread

export interface Slide { title: string; body: string; scene?: string /* direction artistique de la scène (anglais) */ }

export interface ContentResult {
  platform: Platform;
  format: Format;
  slides?: Slide[]; // carousel
  caption?: string; // légende sous le post (IG/LinkedIn)
  hashtags?: string[];
  headline?: string; // gros texte d'accroche (image LinkedIn/IG)
  body?: string; // corps du post
  tweets?: string[]; // thread twitter
}

const VOICE = `Voix Saturn Studio : experte mais accessible, zéro jargon creux (pas de "synergie", "game-changer"), phrases courtes, on parle AU lecteur ("vous"/"tu" selon le réseau). Saturn Studio = agence d'ingénierie d'agents IA + automatisations n8n.`;

// Voix LinkedIn de Fallou (d'après ses posts réels)
const LI_VOICE = `VOIX DE LA MARQUE (à respecter absolument) :
- 1re ligne = HOOK choc / breaking-news / affirmation forte (ex. "🚨 ALERTE : Anthropic vient de sortir Claude…", "Claude vient de tuer la recherche de clients."). Court, ça claque, ça donne envie de cliquer "voir plus".
- Ligne vide, puis corps TRÈS AÉRÉ : une idée par ligne, phrases courtes, beaucoup de sauts de ligne (\\n\\n).
- Utilise des flèches "→" pour énumérer des points concrets.
- Ton direct, tutoiement, zéro corporate, zéro jargon creux. Concret, orienté résultat.
- Termine par un CTA clair : soit "Commente « MOT » et je t'envoie X en DM", soit une question ouverte.
- Pas de hashtags dans le body (ils vont dans "hashtags").`;

function instructions(platform: Platform, format: Format, template?: string): string {
  const tmpl = template ? `\nStyle/DA visuelle choisie : "${template}" — adapte le ton des textes à cette ambiance.` : "";
  if (format === "carousel") {
    const n = platform === "instagram" ? "6 à 8" : "7 à 10";
    return `Format : CARROUSEL ${platform}. Produis ${n} slides.
- slide 1 = HOOK (accroche courte, ≤ 8 mots en "title", + 1 phrase "body").
- slides intermédiaires = 1 idée par slide (title = idée clé courte, body = 1-2 phrases concrètes).
- dernière slide = CTA clair.
Réponds en JSON: {"slides":[{"title":"","body":""}],"caption":"légende engageante avec 1-2 emojis","hashtags":["#..."]}.${tmpl}`;
  }
  if (platform === "twitter" && format === "thread") {
    return `Format : THREAD X (Twitter). 5 à 7 tweets. Tweet 1 = hook fort. Chaque tweet ≤ 270 caractères, autonome. Numérote pas.
Réponds en JSON: {"tweets":["tweet1","tweet2",...]}.`;
  }
  if (platform === "twitter") {
    return `Format : TWEET unique X (Twitter), ≤ 270 caractères, percutant, un angle fort.
Réponds en JSON: {"body":"le tweet","hashtags":["#..."]}.`;
  }
  if (platform === "linkedin" && format === "image") {
    return `Format : POST LinkedIn IMAGE + texte. "headline" = accroche forte qui ira EN GROS sur le visuel (≤ 12 mots). "body" = le post LinkedIn dans la VOIX de Fallou.
${LI_VOICE}
Réponds en JSON: {"headline":"","body":"","hashtags":["#..."]}.${tmpl}`;
  }
  if (platform === "linkedin") {
    return `Format : POST LinkedIn texte, dans la VOIX de Fallou.
${LI_VOICE}
Réponds en JSON: {"body":"le post complet avec sauts de ligne \\n","hashtags":["#..."]}.`;
  }
  // instagram post
  return `Format : POST Instagram (visuel + légende). "headline" = texte court qui ira sur l'image. "caption" = légende engageante avec emojis.
Réponds en JSON: {"headline":"","caption":"","hashtags":["#..."]}.${tmpl}`;
}

/** Échappe les retours-ligne/tab bruts À L'INTÉRIEUR des chaînes JSON (Claude en met parfois). */
function escapeCtrlInStrings(s: string): string {
  let out = "";
  let inStr = false, esc = false;
  for (const ch of s) {
    if (esc) { out += ch; esc = false; continue; }
    if (ch === "\\") { out += ch; esc = true; continue; }
    if (ch === '"') { inStr = !inStr; out += ch; continue; }
    if (inStr && (ch === "\n" || ch === "\r" || ch === "\t")) {
      out += ch === "\n" ? "\\n" : ch === "\r" ? "\\r" : "\\t";
      continue;
    }
    out += ch;
  }
  return out;
}

export async function generateContent(
  platform: Platform,
  format: Format,
  idea: string,
  template?: string,
  ninaBrief?: string // brief de Nina (veille) sur les sujets techniques
): Promise<ContentResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY absente dans .env.local.");
  const system = `Tu es Fatou, copywriter senior chez Saturn Studio. Tu écris du contenu réseaux sociaux qui performe.
${VOICE}
Tu réponds UNIQUEMENT avec un objet JSON valide conforme au format demandé (aucun texte autour, pas de bloc markdown).`;
  const prompt = `Plateforme : ${platform}
${instructions(platform, format, template)}

IDÉE / SUJET : ${idea}
${ninaBrief ? `\n${ninaBrief}\nAppuie-toi sur ce brief : prends ou adapte l'un de ses hooks, glisse au moins une de ses analogies, traduis tout le jargon.\n` : ""}
Rends le JSON maintenant.`;

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { text } = await generateText({
    model: anthropic("claude-sonnet-5"),
    maxOutputTokens: 1800,

    system,
    prompt,
  });
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  let j: Partial<ContentResult> = {};
  try { j = JSON.parse(cleaned) as Partial<ContentResult>; }
  catch {
    try { j = JSON.parse(escapeCtrlInStrings(cleaned)) as Partial<ContentResult>; }
    catch { j = { body: cleaned }; }
  }
  return {
    platform, format,
    slides: j.slides,
    caption: j.caption,
    hashtags: j.hashtags,
    headline: j.headline,
    body: j.body,
    tweets: j.tweets,
  };
}

/* ============ direction artistique des scènes (Fatou, directrice artistique) ============ */
const SCENE_BRIEF: Record<string, string> = {
  bureau: "Orbi dans un espace de travail pastel (bureau, open space, salle de réunion, café) : situations de travail concrètes et un peu drôles.",
  respira: "Orbi dans des lieux réels chaleureux et cinématographiques (jardin, parc, toit au coucher du soleil, rue de Dakar, plage) : ambiance Pixar, respiration, émotion.",
  heros: "Orbi en héros, en contre-plongée face à un ciel bleu : poses iconiques, gestes forts, un objet symbolique tenu vers la caméra.",
  vitrine: "Orbi en sculpture monochrome noir et blanc, mis en scène avec des objets symboliques (architecture, écrans, formes géométriques) : nature morte premium.",
};

/**
 * Pour chaque slide, Fatou écrit la scène qu'Higgsfield va générer : une métaphore visuelle
 * concrète du message, dans un univers cohérent d'une slide à l'autre. Les scènes sont
 * rédigées en anglais (meilleurs résultats du modèle d'images) et ne contiennent aucun texte.
 */
export async function artDirect(slides: Slide[], idea: string, direction: string, analogies: string[] = []): Promise<Slide[]> {
  if (!process.env.ANTHROPIC_API_KEY || !slides.length) return slides;
  const system = `Tu es Fatou, directrice artistique de Saturn Studio et experte du prompt d'image (Higgsfield, GPT Image, Nano Banana, Qwen). Ton style : 3D premium, lumière de cinéma, humour visuel, une idée forte par image. La mascotte s'appelle Orbi : petit robot drone blanc porcelaine, tête ronde, visière noire avec UN œil-anneau de Saturne violet, deux petites oreilles pointues, deux longs bras en lames, lueur verte sous le corps. Orbi n'a NI jambes NI pieds : il FLOTTE toujours. Tu réponds UNIQUEMENT avec un JSON valide.`;
  const prompt = `Carrousel sur : « ${idea} ». Univers visuel imposé : ${SCENE_BRIEF[direction] ?? "scènes 3D premium"}${analogies.length ? `
Analogies proposées par Nina (veille) : ${analogies.join(" | ")} — transforme-les en métaphores visuelles quand elles servent la slide.` : ""}

Slides :
${slides.map((x, i) => `${i + 1}. ${x.title} — ${x.body}`).join("\n")}

Pour CHAQUE slide, écris en ANGLAIS un prompt de scène de 40 à 70 mots, structuré ainsi, dans cet ordre :
1. ACTION : ce que fait "Orbi" (toujours en vol stationnaire, bras-lames expressifs) — une métaphore visuelle concrète, surprenante et un peu drôle du message de la slide, jamais une illustration littérale (pas d'écran d'ordinateur qui « montre » l'idée).
2. DÉCOR ET ACCESSOIRES : lieu précis, 2 ou 3 objets signifiants maximum, matières (porcelaine, verre, chrome, papier, velours…).
3. CADRAGE : échelle de plan (plan large, plan moyen, gros plan), angle (contre-plongée, plongée, hauteur d'œil), focale (24mm, 35mm, 50mm, 85mm).
4. LUMIÈRE ET PALETTE : type de lumière (golden hour, néon, softbox, contre-jour), 2 ou 3 couleurs dominantes cohérentes avec l'univers imposé.
Règles : un seul point focal par image ; varie échelle de plan et angle d'une slide à l'autre (storyboard) mais garde le même lieu et la même lumière sur tout le carrousel ; un seul Orbi ; aucun humain net (silhouettes floues à l'arrière-plan tolérées) ; aucun texte, chiffre, lettre, écran lisible ni logo ; ne jamais écrire « legs », « feet », « standing », « walking » ou « sitting » pour Orbi (écris « hovering », « floating », « perched in mid-air »).
Réponds : {"scenes":["...", "..."]} avec exactement ${slides.length} éléments.`;
  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { text } = await generateText({ model: anthropic("claude-sonnet-5"), maxOutputTokens: 3000, system, prompt });
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const j = JSON.parse(escapeCtrlInStrings(cleaned)) as { scenes?: unknown[] };
    const scenes = Array.isArray(j.scenes) ? j.scenes.map(String) : [];
    return slides.map((x, i) => (scenes[i] ? { ...x, scene: scenes[i] } : x));
  } catch {
    // Sans direction artistique, chaque scène retombe sur un décor dérivé du titre.
    return slides;
  }
}
