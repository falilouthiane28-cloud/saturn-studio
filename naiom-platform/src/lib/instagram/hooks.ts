/**
 * Les 26 formules d'accroche (ig-reel/hooks.json de l'amont) et leurs équivalents français
 * (_saturn/hooks.fr.json). Classement d'une accroche dans une formule, dans l'ordre
 * `classify_order` de l'amont.
 */
import fs from "node:fs";
import path from "node:path";
import { SKILLS_DIR, SATURN_DIR } from "./python.ts";
import { regexPython } from "./portage/detect.ts";
import type { Langue } from "./config.ts";

export interface Formule { id: number; name: string; template: string; example: string; match: string; on_screen?: string; best_for?: string; trap?: string }

let cache: { en: Formule[]; fr: Formule[]; ordre: number[] } | null = null;
export function formules() {
  if (!cache) {
    const en = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, "ig-reel", "hooks.json"), "utf8")) as { hooks: Formule[]; classify_order: number[] };
    const fr = JSON.parse(fs.readFileSync(path.join(SATURN_DIR, "hooks.fr.json"), "utf8")) as { hooks: Formule[] };
    cache = { en: en.hooks, fr: fr.hooks, ordre: en.classify_order };
  }
  return cache;
}

export function formule(id: number, lang: Langue = "fr"): Formule | undefined {
  return formules()[lang].find((f) => f.id === id);
}

/**
 * \b de Python (re, str) est Unicode : « é » y compte comme une lettre. Le \b de JavaScript
 * est ASCII, même avec le drapeau u : on le remplace par une borne Unicode équivalente.
 */
const MOT = "[\\p{L}\\p{N}_]";
const BORNE = `(?:(?<=${MOT})(?!${MOT})|(?<!${MOT})(?=${MOT}))`;
function bornesUnicode(src: string): string {
  return src.replace(/(\\\\)|\\b/g, (m, echappe) => (echappe ? m : BORNE));
}

const compilees = new Map<string, RegExp>();
function compiler(m: string): RegExp {
  let re = compilees.get(m);
  if (!re) { re = regexPython(bornesUnicode(m.startsWith("(?") ? m : `(?i)${m}`), "u"); compilees.set(m, re); }
  return re;
}

/** Id de la formule reconnue (null si aucune). Le français essaie ses motifs puis ceux de l'amont. */
export function classer(accroche: string, lang: Langue = "fr"): number | null {
  const { en, fr, ordre } = formules();
  // Les motifs écrivent l'apostrophe droite ; « j’ai » (typographique) doit être reconnu pareil.
  accroche = accroche.replace(/[‘’]/g, "'");
  for (const id of ordre) {
    const motifs = [lang === "fr" ? fr.find((f) => f.id === id)?.match : undefined, en.find((f) => f.id === id)?.match].filter(Boolean) as string[];
    for (const m of motifs) {
      if (compiler(m).test(accroche)) return id;
    }
  }
  return null;
}
