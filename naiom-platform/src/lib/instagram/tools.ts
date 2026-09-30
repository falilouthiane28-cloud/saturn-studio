/**
 * Outils du pack Instagram, appelables par les agents (entrées et sorties typées).
 * Anglais : les scripts Python d'origine répondent directement (référence).
 * Français : mêmes formules via les portages vérifiés + listes françaises (voir fr.ts) ;
 * les résultats portent `fiabilite` pour dire ce qui est fiable et ce qui est indicatif.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { runPython, runPythonJson, SKILLS_DIR } from "./python.ts";
import { LANG, type Langue } from "./config.ts";
import { scoreHook, type HookScore } from "./portage/hookscore.ts";
import { detecter, type Detection } from "./portage/detect.ts";
import { DETECT_FR, HOOK_FR, lexiqueFr, protegerTypo, restaurerTypo } from "./fr.ts";
import { classer } from "./hooks.ts";

export type Fiabilite = "fiable" | "indicatif";

/* ---------------- hookscore ---------------- */
export interface HookResultat extends HookScore { formula_id: number | null }
export interface HookClassement {
  lang: Langue;
  resultats: HookResultat[]; // ordre d'entrée
  classement: HookResultat[]; // du meilleur au moins bon
  pasEncoreDAccroche: boolean; // meilleur score < 50 : « aucune n'est l'accroche »
  fiabilite: Fiabilite;
}
export async function hookscore(accroches: string[], lang: Langue = LANG): Promise<HookClassement> {
  const lignes = accroches.map((a) => a.replace(/\s+/g, " ").trim()).filter(Boolean);
  if (!lignes.length) throw new Error("Aucune accroche à noter.");
  let scores: HookScore[];
  if (lang === "en") {
    const ref = await runPythonJson<HookScore | HookScore[]>("hookscore", async (dir) => {
      const f = path.join(dir, "hooks.txt");
      await fsp.writeFile(f, lignes.join("\n"), "utf8");
      return [f, "--json"];
    });
    scores = Array.isArray(ref) ? ref : [ref];
  } else {
    scores = lignes.map((l) => scoreHook(HOOK_FR, l));
  }
  const resultats = scores.map((s) => ({ ...s, formula_id: classer(s.hook, lang) }));
  const classement = [...resultats].sort((a, b) => b.score - a.score);
  return { lang, resultats, classement, pasEncoreDAccroche: classement[0].score < 50, fiabilite: lang === "en" ? "fiable" : "indicatif" };
}

/* ---------------- beats ---------------- */
export interface Beat { n: number; start: number; dur: number; words: number; text: string; concrete: number; label: string; flags: string[] }
export interface Beats { wpm: number; target: number | null; total_seconds: number; total_words: number; beats: Beat[]; notes: string[]; fiabilite: Fiabilite }
export async function beats(script: string, opts: { target?: number; wpm?: number } = {}, lang: Langue = LANG): Promise<Beats> {
  const args = ["-", "--json"];
  if (opts.target) args.push("--target", String(opts.target));
  if (opts.wpm) args.push("--wpm", String(opts.wpm));
  const r = await runPythonJson<Omit<Beats, "fiabilite">>("beats", () => args, { stdin: script });
  // Durées et découpage : fiables en toutes langues ; « concret » repose sur des marqueurs anglais.
  return { ...r, fiabilite: lang === "en" ? "fiable" : "indicatif" };
}

/* ---------------- caption lint ---------------- */
export interface CaptionCheck { check: string; status: "PASS" | "WARN" | "FAIL"; detail: string }
export interface CaptionLint {
  characters: number; limit: number; truncate_at: number; visible: string; truncated: boolean; first_line_chars: number;
  hashtags: string[]; mentions: string[]; links: string[]; emoji: number; asks: string[]; checks: CaptionCheck[]; verdict: string;
  fiabilite: Fiabilite;
}
export async function captionLint(legende: string, keywords: string[] = [], lang: Langue = LANG): Promise<CaptionLint> {
  const args = ["-", "--json"];
  if (keywords.length) args.push("--keywords", keywords.map((k) => k.replace(/,/g, " ").trim()).filter(Boolean).join(","));
  const r = await runPythonJson<Omit<CaptionLint, "fiabilite">>("caption", () => args, { stdin: legende });
  // Longueur, liens, hashtags, troncature : indépendants de la langue. Détection des « asks » : anglaise.
  return { ...r, fiabilite: lang === "en" ? "fiable" : "indicatif" };
}

/* ---------------- ig-human : humanize + detect ---------------- */
export interface Humanize { text: string; report: Record<string, unknown[]> }
async function avecLexique(dir: string, lang: Langue): Promise<string[]> {
  if (lang === "en") return [];
  const f = path.join(dir, "slop.fusion.json");
  await fsp.writeFile(f, JSON.stringify(lexiqueFr()), "utf8");
  return ["--lexicon", f];
}
export async function humanize(texte: string, lang: Langue = LANG): Promise<Humanize> {
  const entree = lang === "fr" ? protegerTypo(texte) : texte;
  const r = await runPythonJson<Humanize>("humanize", async (dir) => ["-", "--json", ...(await avecLexique(dir, lang))], { stdin: entree });
  return { text: lang === "fr" ? restaurerTypo(r.text) : r.text, report: r.report };
}

export interface Detect extends Detection { fiabilite: Record<string, Fiabilite> }
export async function detect(texte: string, lang: Langue = LANG): Promise<Detect> {
  if (lang === "en") {
    const r = await runPythonJson<Detection>("detect", async (dir) => {
      const f = path.join(dir, "texte.txt");
      await fsp.writeFile(f, texte, "utf8");
      return [f, "--json"];
    });
    const { source: _s, ...d } = r;
    return { ...d, fiabilite: toutesFiables() };
  }
  return {
    ...detecter(DETECT_FR, texte, lexiqueFr()),
    fiabilite: { BURSTINESS: "fiable", FINGERPRINT: "fiable", "SLOP DENSITY": "indicatif", SPECIFICITY: "indicatif", VOICE: "indicatif" },
  };
}
const toutesFiables = () => ({ BURSTINESS: "fiable", SPECIFICITY: "fiable", "SLOP DENSITY": "fiable", FINGERPRINT: "fiable", VOICE: "fiable" }) as Record<string, Fiabilite>;

/** Avant / après : deux panneaux, et l'écart. */
export async function detectAvantApres(avant: string, apres: string, lang: Langue = LANG) {
  const [a, b] = await Promise.all([detect(avant, lang), detect(apres, lang)]);
  return { avant: a, apres: b, ecart: Math.round((b.human_score - a.human_score) * 10) / 10 };
}

/**
 * Passage obligatoire avant de montrer un texte (règle 5) : nettoyage puis panneau de détection.
 * On montre le texte ET le score. Ce sont des heuristiques locales : jamais « indétectable ».
 */
export async function passerIgHuman(texte: string, lang: Langue = LANG) {
  const h = await humanize(texte, lang);
  const d = await detect(h.text, lang);
  return { text: h.text, report: h.report, human_score: d.human_score, verdict: d.verdict, checks: d.checks, fiabilite: d.fiabilite };
}

/* ---------------- swipe ---------------- */
export interface SwipeLigne { account: string; followers?: number; median?: number; views: number; hook: string }
export async function swipe(lignes: SwipeLigne[], opts: { outPath?: string; outDir?: string } = {}, lang: Langue = LANG) {
  if (lignes.some((l) => !/^@?[\w.]{1,40}$/.test(l.account))) throw new Error("Chaque ligne doit être attribuée à son compte source (@compte).");
  const propre = (v: unknown) => String(v ?? "").replace(/[\t\r\n]+/g, " ").trim();
  const tsv = ["account\tfollowers\tmedian\tviews\thook", ...lignes.map((l) => [l.account, l.followers ?? "", l.median ?? "", l.views, propre(l.hook)].map(propre).join("\t"))].join("\n");
  const r = await runPythonJson<{ reels: { hook: string; formula_id: number | null; formula: string }[] } & Record<string, unknown>>(
    "swipe", () => ["-", "--json", ...(opts.outPath ? ["--out", opts.outPath] : [])], { stdin: tsv, extraDirs: opts.outDir ? [opts.outDir] : [] });
  // Accroches françaises que les motifs anglais ne reconnaissent pas : classement français.
  if (lang === "fr") for (const x of r.reels) if (x.formula_id == null) x.formula_id = classer(x.hook, "fr");
  return r;
}

/* ---------------- score de profil (rubric.json, sans script amont) ---------------- */
interface Rubrique { total: number; items: { id: string; points: number; full_marks: string; common_fail?: string }[] }
let rubrique: Rubrique | null = null;
export function lireRubrique(): Rubrique {
  rubrique ??= JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, "ig-profile", "rubric.json"), "utf8")) as Rubrique;
  return rubrique;
}
/** Additionne les notes données critère par critère, en vérifiant chaque note contre la grille. */
export function scoreProfil(notes: Record<string, number>) {
  const r = lireRubrique();
  const inconnus = Object.keys(notes).filter((k) => !r.items.some((i) => i.id === k));
  if (inconnus.length) throw new Error(`Critère(s) absent(s) de rubric.json : ${inconnus.join(", ")}`);
  const manquants = r.items.filter((i) => notes[i.id] === undefined).map((i) => i.id);
  if (manquants.length) throw new Error(`Note manquante pour : ${manquants.join(", ")}`);
  const items = r.items.map((i) => {
    const n = notes[i.id];
    if (!Number.isFinite(n) || n < 0 || n > i.points) throw new Error(`${i.id} : note ${n} hors de 0-${i.points}`);
    return { id: i.id, note: n, sur: i.points, manque: i.points - n };
  });
  const total = items.reduce((a, i) => a + i.note, 0);
  return { total, sur: r.total, items, aTravailler: [...items].sort((a, b) => b.manque - a.manque).slice(0, 3).filter((i) => i.manque > 0) };
}

/** Accès brut aux scripts, pour les tests de parité. */
export { runPython };
