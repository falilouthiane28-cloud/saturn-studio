/**
 * Nina (veille) en renfort de Fatou sur les sujets techniques : elle juge le niveau
 * technique du sujet et, s'il est élevé, prépare un brief de portée — hooks viraux,
 * analogies du quotidien, jargon traduit, faits vérifiés (recherche web) — pour que
 * Fatou vulgarise et touche le public le plus large possible.
 */
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs } from "ai";
import type { Platform } from "./generate";

export interface NinaBrief {
  technical: boolean;
  level: number; // 0 (grand public) → 10 (très technique)
  audience: string; // à qui on parle, en une phrase
  hooks: string[];
  analogies: string[];
  jargon: { term: string; simple: string }[];
  facts: string[];
  avoid: string[];
}

/** À partir de ce niveau, Nina intervient. */
const TECH_THRESHOLD = 5;

const SYSTEM = `Tu es Nina, agente de veille de Saturn Studio (agence d'agents IA et d'automatisations n8n). Ton métier : savoir ce qui fait exploser la portée d'un post sur les réseaux, et rendre un sujet technique compréhensible par tout le monde sans le trahir.
Tu ne fabriques jamais de chiffre : un fait doit venir de ta recherche web ou être une vérité générale sûre. Si tu n'es pas sûre, tu ne l'écris pas.
Ta réponse finale est UNIQUEMENT un objet JSON valide.`;

function prompt(idea: string, platform: Platform): string {
  return `Sujet du post (${platform}) : « ${idea} »

1. Évalue le niveau technique du sujet pour un public large (0 = grand public, 10 = réservé aux experts).
2. S'il est ≥ ${TECH_THRESHOLD}, fais au besoin 1 à 3 recherches web pour vérifier les faits récents, puis prépare le brief. Sinon, n'effectue aucune recherche.

Réponds avec ce JSON (listes vides si non technique) :
{"level": 0-10,
 "audience": "à qui s'adresser en une phrase (ex. dirigeants de PME non techniques)",
 "hooks": ["3 hooks viraux adaptés à ${platform}, en français, ≤ 12 mots, curiosité ou bénéfice concret"],
 "analogies": ["2 ou 3 analogies du quotidien qui font comprendre le concept en une image"],
 "jargon": [{"term": "terme technique", "simple": "traduction en mots simples"}],
 "facts": ["3 à 5 faits clés exacts et à jour, avec la source entre parenthèses"],
 "avoid": ["erreurs à éviter pour ne pas perdre le public"]}`;
}

function lastJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/```(?:json)?/gi, "");
  const start = cleaned.lastIndexOf("{\"level\"");
  const from = start >= 0 ? start : cleaned.indexOf("{");
  if (from < 0) return null;
  let depth = 0;
  for (let i = from; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}" && --depth === 0) {
      try { return JSON.parse(cleaned.slice(from, i + 1)) as Record<string, unknown>; } catch { return null; }
    }
  }
  return null;
}

const strs = (v: unknown) => (Array.isArray(v) ? v.map(String).filter(Boolean) : []);

/** Brief de Nina, ou null si indisponible. `technical` indique si Fatou doit s'en servir. */
export async function ninaBrief(idea: string, platform: Platform): Promise<NinaBrief | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { text } = await generateText({
      model: anthropic("claude-sonnet-5"),
      maxOutputTokens: 2000,
      system: SYSTEM,
      prompt: prompt(idea, platform),
      tools: { web_search: anthropic.tools.webSearch_20250305({ maxUses: 3 }) },
      stopWhen: stepCountIs(5),
    });
    const j = lastJson(text);
    if (!j) return null;
    const level = Math.max(0, Math.min(10, Number(j.level) || 0));
    return {
      technical: level >= TECH_THRESHOLD,
      level,
      audience: String(j.audience ?? ""),
      hooks: strs(j.hooks),
      analogies: strs(j.analogies),
      jargon: Array.isArray(j.jargon)
        ? (j.jargon as { term?: unknown; simple?: unknown }[]).map((x) => ({ term: String(x.term ?? ""), simple: String(x.simple ?? "") })).filter((x) => x.term)
        : [],
      facts: strs(j.facts),
      avoid: strs(j.avoid),
    };
  } catch {
    return null;
  }
}

/** Brief formaté pour le prompt de Fatou. */
export function briefForWriter(b: NinaBrief): string {
  return `BRIEF DE NINA (veille) — sujet technique (niveau ${b.level}/10), objectif : toucher le public le plus large possible.
Public : ${b.audience}
Hooks qui performent : ${b.hooks.map((h) => `« ${h} »`).join(" / ")}
Analogies à utiliser : ${b.analogies.join(" | ")}
Jargon à traduire : ${b.jargon.map((x) => `${x.term} = ${x.simple}`).join(" ; ")}
Faits vérifiés (n'invente aucun autre chiffre) : ${b.facts.join(" | ")}
À éviter : ${b.avoid.join(" | ")}
RÈGLES DE VULGARISATION : zéro terme technique sans sa traduction simple ; une analogie du quotidien au moins ; phrases courtes ; un lycéen doit tout comprendre ; mais reste exact.`;
}
