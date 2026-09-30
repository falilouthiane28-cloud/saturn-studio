/**
 * Portage fidèle de ig-reel/hookscore.py, paramétré par une « langue » (listes de mots et
 * motifs). La langue "en" reprend à l'identique les listes de l'original : les tests golden
 * vérifient que ce portage rend exactement la sortie JSON du script Python. La langue "fr"
 * ne change que les listes (voir ../fr/hookscoreFr.ts) — les formules de score sont les mêmes.
 */
import { clamp, moyenne, arrondi1 } from "./maths.ts";

export interface LangueHook {
  motRe: RegExp; // global
  nombreRe: RegExp; // global
  propreRe: RegExp; // global
  hashtagRe: RegExp;
  emojiRe: RegExp;
  nombresParles: Set<string>;
  motsArgent: Set<string>;
  enjeu: Set<string>;
  ouverturesFaibles: string[];
  imperatifs: Set<string>;
  redhibitoires: [RegExp, string][];
  prixRe: RegExp; // « a price »
  toiRe: RegExp;
  moiRe: RegExp;
  separateurMilliers: RegExp; // global
  libelles: {
    prix: string; mots: (n: number, c: number, s: number) => string;
    concrets: (n: number, trouves: string) => string; rienConcret: string;
    tension: (n: number, m: string[]) => string; rienEnjeu: string;
    vide: string; aucunPayload: string; payloadA: (i: number) => string; payloadAvancer: (i: number) => string;
    payloadTard: (i: number) => string; ouvertureFaible: (o: string) => string;
    parleAuSpectateur: string; imperatif: (w: string) => string; premierePersonne: string; troisiemePersonne: string;
  };
}

export const CHECKS = ["LENGTH", "SPECIFICITY", "STAKES", "FRONTLOAD", "ADDRESS"] as const;
type Check = (typeof CHECKS)[number];

/** Tokenisation : « $18,000 » est un seul mot (virgule de milliers retirée avant découpe). */
function mots(L: LangueHook, text: string): string[] {
  return text.replace(L.separateurMilliers, "").match(L.motRe) ?? [];
}
const bas = (w: string) => w.toLowerCase().replace(/^['’]+|['’]+$/g, "");

function checkLength(L: LangueHook, text: string): [number, string] {
  const n = mots(L, text).length;
  const secs = n / 2.75;
  const chars = [...text.trim()].length; // len() Python = points de code (un émoji = 1)
  let score: number;
  if (n >= 5 && n <= 12) score = 100.0;
  else if (n < 5) score = clamp(100 - (5 - n) * 20);
  else score = clamp(100 - (n - 12) * 11);
  if (chars > 60) score -= 12;
  return [clamp(score), L.libelles.mots(n, chars, secs)];
}

function checkSpecificity(L: LangueHook, text: string): [number, string] {
  const nums = (text.match(L.nombreRe) ?? []).map((n) => n.trim()).filter(Boolean);
  const propres = [...new Set(text.match(L.propreRe) ?? [])];
  const low = mots(L, text).map(bas);
  const parles = low.filter((w) => L.nombresParles.has(w) || L.motsArgent.has(w));
  const hits = nums.length + propres.length + parles.length;
  const score = hits === 0 ? 15.0 : clamp(45 + hits * 30);
  const trouves = [...nums.slice(0, 2), ...[...propres].sort().slice(0, 2), ...parles.slice(0, 2)].join(", ");
  return [score, trouves ? L.libelles.concrets(hits, trouves) : L.libelles.concrets(hits, "") + L.libelles.rienConcret];
}

function checkStakes(L: LangueHook, text: string): [number, string] {
  const w = mots(L, text).map(bas);
  const marqueurs = [...new Set(w.filter((x) => L.enjeu.has(x)))].sort();
  if (L.prixRe.test(text)) marqueurs.push(L.libelles.prix);
  const n = marqueurs.length;
  const score = n === 0 ? 20.0 : n === 1 ? 70.0 : 100.0;
  return [clamp(score), marqueurs.length ? L.libelles.tension(n, marqueurs.slice(0, 4)) : L.libelles.tension(n, []) + L.libelles.rienEnjeu];
}

/** Équivalent de re.match(motif, mot) : le motif doit correspondre à partir du début du mot. */
function correspondAuDebut(re: RegExp, w: string): boolean {
  const collant = new RegExp(re.source, re.flags.replace("g", "") + "y");
  return collant.test(w);
}

function checkFrontload(L: LangueHook, text: string): [number, string] {
  const w = mots(L, text);
  if (!w.length) return [0.0, L.libelles.vide];
  const low = w.map(bas);
  const ouverture = low.slice(0, 2).join(" ");
  let penalite = 0;
  let faible: string | null = null;
  for (const weak of L.ouverturesFaibles) {
    if (ouverture.startsWith(weak) || low[0] === weak) { penalite = 30; faible = weak; break; }
  }
  let payload: number | null = null;
  for (let i = 0; i < low.length; i++) {
    if (L.enjeu.has(low[i]) || L.nombresParles.has(low[i]) || L.motsArgent.has(low[i])
      || correspondAuDebut(L.nombreRe, w[i])
      // Fidèle à l'original : PROPER_RE.match(mot) échoue toujours ((?<!^) au début du mot).
      || (i > 0 && correspondAuDebut(L.propreRe, w[i]))) { payload = i; break; }
  }
  let base: number, ou: string;
  if (payload === null) { base = 30.0; ou = L.libelles.aucunPayload; }
  else if (payload <= 3) { base = 100.0; ou = L.libelles.payloadA(payload + 1); }
  else if (payload <= 6) { base = 70.0; ou = L.libelles.payloadAvancer(payload + 1); }
  else { base = 40.0; ou = L.libelles.payloadTard(payload + 1); }
  return [clamp(base - penalite), ou + (faible ? L.libelles.ouvertureFaible(faible) : "")];
}

function checkAddress(L: LangueHook, text: string): [number, string] {
  const low = text.toLowerCase();
  const w = mots(L, text).map(bas);
  if (L.toiRe.test(low)) return [100.0, L.libelles.parleAuSpectateur];
  if (w.length && L.imperatifs.has(w[0])) return [90.0, L.libelles.imperatif(w[0])];
  if (L.moiRe.test(low)) return [70.0, L.libelles.premierePersonne];
  return [35.0, L.libelles.troisiemePersonne];
}

export interface HookScore {
  hook: string;
  checks: Record<Check, { score: number; detail: string }>;
  weakest: Check;
  flags: string[];
  score: number;
  verdict: "STRONG" | "OK" | "WEAK";
}

export function scoreHook(L: LangueHook, line: string): HookScore {
  const res: Record<Check, [number, string]> = {
    LENGTH: checkLength(L, line),
    SPECIFICITY: checkSpecificity(L, line),
    STAKES: checkStakes(L, line),
    FRONTLOAD: checkFrontload(L, line),
    ADDRESS: checkAddress(L, line),
  };
  const flags = L.redhibitoires.filter(([re]) => { re.lastIndex = 0; return re.test(line); }).map(([, msg]) => msg);
  const scores = CHECKS.map((c) => res[c][0]);
  const overall = clamp(moyenne(scores) * 0.6 + Math.min(...scores) * 0.4 - flags.length * 15);
  const verdict = overall >= 70 && Math.min(...scores) >= 55 && !flags.length ? "STRONG" : overall >= 50 ? "OK" : "WEAK";
  // min() de Python garde le premier en cas d'égalité : même ordre ici.
  const weakest = CHECKS.reduce((a, c) => (res[c][0] < res[a][0] ? c : a), CHECKS[0]);
  const checks = Object.fromEntries(CHECKS.map((c) => [c, { score: arrondi1(res[c][0]), detail: res[c][1] }])) as HookScore["checks"];
  return { hook: line, checks, weakest, flags, score: arrondi1(overall), verdict };
}
