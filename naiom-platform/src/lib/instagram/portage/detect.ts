/**
 * Portage fidèle de ig-human/detect.py (cinq contrôles locaux), paramétré par langue.
 * Langue "en" = règles d'origine (vérifiées par test golden contre le Python) ;
 * "fr" ne remplace que les motifs et listes (voir ../fr/detectFr.ts).
 * Ce sont des heuristiques locales, pas GPTZero ni Originality.
 */
import { clamp, moyenne, ecartType, arrondi1, fmt1 } from "./maths.ts";

export interface Lexique {
  words: { find: string; replace?: string; family?: string }[];
  phrases: { find: string; replace?: string; family?: string }[];
  structures: { id: string; regex: string; name?: string; fix?: string }[];
}

export interface LangueDetect {
  motRe: RegExp; // global
  contractionsRe: RegExp; // global
  pronomsRe: RegExp; // global
  nombresRe: RegExp; // global
  propresRe: RegExp; // global + m
  /** Bornes de mot autour d'une entrée du lexique (\b en anglais, bornes Unicode en français). */
  borne: [string, string];
  /** Espaces insécables comptés comme « tells » (le français en exclut les usages typographiques). */
  compterEspacesDurs: (text: string) => number;
  /** Guillemets et apostrophes courbes comptés (le français excepte l'apostrophe typographique « c’est »). */
  compterCourbes?: (text: string) => number;
  seuilsVoix: { contractionsHumain: number };
}

const CHECKS = ["BURSTINESS", "SPECIFICITY", "SLOP DENSITY", "FINGERPRINT", "VOICE"] as const;
export type CheckDetect = (typeof CHECKS)[number];

/** scale() de detect.py : `human` → 100, `machine` → 0. */
function scale(value: number, human: number, machine: number): number {
  if (human === machine) return 50.0;
  return clamp(((value - machine) / (human - machine)) * 100);
}

/** Une regex Python du lexique → RegExp JavaScript (drapeaux en ligne, \U0001F680). */
export function regexPython(src: string, flagsBase = "gmu"): RegExp {
  let flags = flagsBase;
  const m = /^\(\?([imsx]+)\)/.exec(src);
  if (m) {
    src = src.slice(m[0].length);
    for (const f of m[1]) if (f !== "x" && !flags.includes(f)) flags += f;
  }
  src = src.replace(/\\U([0-9A-Fa-f]{8})/g, (_, h) => `\\u{${parseInt(h, 16).toString(16)}}`);
  // Python accepte « \" » ou « \' » ; en mode Unicode, JavaScript refuse ces échappements inutiles.
  src = src.replace(/\\(["'#&~%!@,;:<=>`])/g, "$1");
  return new RegExp(src, flags);
}

/** re.escape() de Python, puis « \ » (espace échappé) → \s+ comme dans detect.py. */
function motifEntree(find: string, L: LangueDetect): RegExp {
  // En mode Unicode, JavaScript refuse d'échapper - # & ~ hors classe : on n'échappe que ses métacaractères.
  const esc = find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  return new RegExp(L.borne[0] + esc + L.borne[1], "giu");
}

const nbMots = (L: LangueDetect, t: string) => (t.match(L.motRe) ?? []).length;
const phrases = (t: string) => (t.match(/[^.!?\n]+[.!?]*/g) ?? []).map((s) => s.trim()).filter((s) => s.split(/\s+/).filter(Boolean).length > 2);

function burstiness(text: string): [number, string] {
  const lens = phrases(text).map((s) => s.split(/\s+/).filter(Boolean).length);
  if (lens.length < 4) return [50.0, "too short to judge"];
  const m = moyenne(lens);
  const cv = m ? ecartType(lens) / m : 0;
  return [scale(cv, 0.7, 0.22), `variation ${cv.toFixed(2)} across ${lens.length} sentences (want 0.55+)`];
}

function specificity(L: LangueDetect, text: string): [number, string] {
  const n = nbMots(L, text);
  if (n < 25) return [50.0, "too short to judge"];
  const hits = (text.match(L.nombresRe) ?? []).length + new Set(text.match(L.propresRe) ?? []).size;
  const density = (hits * 100) / n;
  return [scale(density, 6.0, 0.5), `${hits} concrete markers, ${fmt1(density)} per 100 words (want 4+)`];
}

function slop(L: LangueDetect, text: string, lex: Lexique): [number, string] {
  const n = nbMots(L, text);
  if (!n) return [50.0, "empty"];
  let hits = 0;
  const found: string[] = [];
  for (const e of [...lex.words, ...lex.phrases]) {
    const k = (text.match(motifEntree(e.find, L)) ?? []).length;
    if (k) { hits += k; found.push(e.find); }
  }
  const density = (hits * 100) / n;
  let detail = `${hits} stock terms, ${fmt1(density)} per 100 words`;
  // sorted() de Python : ordre des points de code (pas localeCompare).
  const tri = [...found].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (tri.length) detail += " (" + tri.slice(0, 4).join(", ") + (tri.length > 4 ? ", ..." : "") + ")";
  return [scale(density, 0.0, 4.0), detail];
}

function fingerprint(L: LangueDetect, text: string): [number, string] {
  const invisible = (text.match(/\p{Cf}/gu) ?? []).length;
  const em = text.split("—").length - 1;
  const curly = L.compterCourbes ? L.compterCourbes(text) : (text.match(/[‘’“”]/g) ?? []).length;
  const ellip = text.split("…").length - 1;
  const nbsp = L.compterEspacesDurs(text);
  const total = invisible * 4 + em * 2 + curly + ellip + nbsp;
  const per1k = (total * 1000) / Math.max([...text].length, 1);
  return [scale(per1k, 0.0, 12.0), `${invisible} invisible, ${em} em dash, ${curly} curly quote, ${ellip} ellipsis, ${nbsp} hard space`];
}

function voice(L: LangueDetect, text: string, lex: Lexique): [number, string] {
  const n = nbMots(L, text);
  if (n < 25) return [50.0, "too short to judge"];
  const per100 = 100 / n;
  const contractions = (text.match(L.contractionsRe) ?? []).length * per100;
  const person = (text.match(L.pronomsRe) ?? []).length * per100;
  let tells = 0;
  const names: string[] = [];
  for (const s of lex.structures) {
    let re: RegExp;
    try { re = regexPython(s.regex); } catch { continue; }
    const k = (text.match(re) ?? []).length;
    if (k) { tells += k; names.push(s.id); }
  }
  const bullets = [...text.matchAll(/^\s*[-*•]\s+(.+)$/gmu)].map((m) => m[1].split(/\s+/).filter(Boolean).length);
  const uniform = bullets.length >= 3 && ecartType(bullets) < 1.6;
  let score = scale(contractions, L.seuilsVoix.contractionsHumain, 0.0) * 0.35 + scale(person, 8.0, 1.0) * 0.35 + clamp(100 - tells * 22) * 0.3;
  if (uniform) { score -= 12; names.push("uniform-bullets"); }
  let detail = `${fmt1(contractions)} contractions, ${fmt1(person)} personal pronouns per 100 words, ${tells} structural tell(s)`;
  if (names.length) detail += " [" + names.slice(0, 4).join(", ") + "]";
  return [clamp(score), detail];
}

export interface Detection {
  source?: string;
  checks: Record<CheckDetect, { score: number; detail: string }>;
  human_score: number;
  verdict: "PASS" | "REVIEW" | "FLAGGED";
}

export function detecter(L: LangueDetect, text: string, lex: Lexique): Detection {
  const r: Record<CheckDetect, [number, string]> = {
    BURSTINESS: burstiness(text),
    SPECIFICITY: specificity(L, text),
    "SLOP DENSITY": slop(L, text, lex),
    FINGERPRINT: fingerprint(L, text),
    VOICE: voice(L, text, lex),
  };
  const scores = CHECKS.map((c) => r[c][0]);
  const overall = moyenne(scores) * 0.6 + Math.min(...scores) * 0.4;
  const verdict = overall >= 70 && Math.min(...scores) >= 55 ? "PASS" : overall >= 50 ? "REVIEW" : "FLAGGED";
  return {
    checks: Object.fromEntries(CHECKS.map((c) => [c, { score: arrondi1(r[c][0]), detail: r[c][1] }])) as Detection["checks"],
    human_score: arrondi1(overall),
    verdict,
  };
}

/** Langue « en » : motifs exacts de detect.py. */
export const DETECT_EN: LangueDetect = {
  motRe: /[A-Za-z']+/g,
  contractionsRe: /\b\w+'(?:s|t|re|ve|ll|d|m)\b/gi,
  pronomsRe: /\b(i|me|my|mine|we|us|our|you|your)\b/gi,
  nombresRe: /\b\d[\d,.]*%?\b|\$\d/g,
  propresRe: /(?<![.!?]\s)(?<!^)\b[A-Z][a-z]{2,}\b/gm,
  borne: ["\\b", "\\b"],
  compterEspacesDurs: (t) => (t.match(/[\u00A0\u202F\u2009]/g) ?? []).length,
  seuilsVoix: { contractionsHumain: 3.0 },
};
