/**
 * Calibrage français (ajout Saturn, l'amont n'est pas modifié).
 * Mêmes formules que hookscore.py / detect.py (portages vérifiés en anglais par tests golden),
 * avec des listes françaises, des bornes de mot Unicode et la typographie française tenue pour
 * légitime : espace insécable avant : ; ! ? % €, à l'intérieur des « », entre groupes de chiffres,
 * et apostrophe typographique entre deux lettres (« c’est »).
 */
import fs from "node:fs";
import path from "node:path";
import type { LangueHook } from "./portage/hookscore.ts";
import type { LangueDetect, Lexique } from "./portage/detect.ts";
import { fmt1 } from "./portage/maths.ts";
import { SATURN_DIR, SKILLS_DIR } from "./python.ts";

const L = "\\p{L}";
const ESP = " " + String.fromCodePoint(0xa0, 0x202f); // espace, insécable, fine insécable
const UNITES = String.raw`%|€|euros?\b|francs?\b|fcfa\b|k\b|x\b|h\b|heures?\b|min\b|minutes?\b|jours?\b|semaines?\b|mois\b|ans\b|années?\b|fois\b`;
const HORS_MOT_AVANT = `(?<![${L}\\p{N}_])`;
const HORS_MOT_APRES = `(?![${L}\\p{N}_])`;
const mots = (liste: string) => new RegExp(`${HORS_MOT_AVANT}(?:${liste})${HORS_MOT_APRES}`, "iu");

/* ---------- typographie française ---------- */
const ESPACES_DURS = /[   ]/g; // insécable, fine insécable, fine
/** Espace dur légitime en français : avant : ; ! ? % € », après «, entre chiffres (1 500). */
function espaceDurLegitime(text: string, i: number): boolean {
  const avant = text[i - 1] ?? "";
  const apres = text[i + 1] ?? "";
  return /[:;!?%€»]/.test(apres) || avant === "«" || (/\d/.test(avant) && /\d/.test(apres));
}
export function espacesDursNonTypographiques(text: string): number {
  let n = 0;
  for (const m of text.matchAll(ESPACES_DURS)) if (!espaceDurLegitime(text, m.index)) n++;
  return n;
}
/** Courbes comptées comme « tell » : ‘ “ ”, et ’ sauf entre deux lettres (apostrophe française). */
export function courbesNonTypographiques(text: string): number {
  let n = (text.match(/[‘“”]/g) ?? []).length;
  for (const m of text.matchAll(/’/g)) {
    const i = m.index;
    if (!(/\p{L}/u.test(text[i - 1] ?? "") && /\p{L}/u.test(text[i + 1] ?? ""))) n++;
  }
  return n;
}

/* ---------- humanize : protection de la typographie française ---------- */
// Caractères à usage privé (catégorie Co) : humanize.py ne les supprime ni ne les remplace.
const cp = (n: number) => String.fromCodePoint(n);
// Espace insécable, espace fine insécable, espace fine, apostrophe typographique → caractères privés.
const PROTEGE: Record<string, string> = { [cp(0xa0)]: cp(0xe0a0), [cp(0x202f)]: cp(0xe0af), [cp(0x2009)]: cp(0xe009), [cp(0x2019)]: cp(0xe019) };
const RESTAURE = Object.fromEntries(Object.entries(PROTEGE).map(([a, b]) => [b, a]));
const PRIVES = new RegExp(`[${Object.values(PROTEGE).join("")}]`, "gu");
const APOSTROPHE_ENTRE_LETTRES = new RegExp(`(?<=\\p{L})${cp(0x2019)}(?=\\p{L})`, "gu");
/** Remplace la typographie française légitime par des caractères privés avant humanize.py. */
export function protegerTypo(text: string): string {
  const espaces = text.replace(ESPACES_DURS, (c, i: number) => (espaceDurLegitime(text, i) ? PROTEGE[c] : c));
  // Apostrophe typographique entre deux lettres (« j’ai ») : correcte en français, on la garde.
  return espaces.replace(APOSTROPHE_ENTRE_LETTRES, PROTEGE[cp(0x2019)]);
}
export function restaurerTypo(text: string): string {
  return text.replace(PRIVES, (c) => RESTAURE[c]);
}

/* ---------- lexique fusionné (amont + français) ---------- */
let lexiqueCache: Lexique & Record<string, unknown> | null = null;
export function lexiqueFr(): Lexique & Record<string, unknown> {
  if (!lexiqueCache) {
    const en = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, "ig-human", "slop.json"), "utf8"));
    const fr = JSON.parse(fs.readFileSync(path.join(SATURN_DIR, "slop.fr.json"), "utf8"));
    lexiqueCache = { ...en, words: [...en.words, ...fr.words], phrases: [...en.phrases, ...fr.phrases], structures: [...en.structures, ...fr.structures] };
  }
  return lexiqueCache!;
}

/* ---------- détecteur : langue « fr » ---------- */
export const DETECT_FR: LangueDetect = {
  motRe: /[\p{L}'’]+/gu,
  // Élisions obligatoires (c'est, l'a) = aucune info. On compte l'oral : t'es, y'a, j'suis, p'tit, ouais…
  contractionsRe: new RegExp(`${HORS_MOT_AVANT}(?:t['’](?:es|as|étais|avais)|y['’]?a|j['’](?:suis|sais|vais|peux|crois|te)|chuis|chais|p['’]tite?|m['’]fait|ouais|bah|ben)${HORS_MOT_APRES}`, "giu"),
  pronomsRe: new RegExp(`${HORS_MOT_AVANT}(?:je|moi|mon|ma|mes|me|nous|notre|nos|on|tu|toi|ton|ta|tes|te|vous|votre|vos)${HORS_MOT_APRES}|${HORS_MOT_AVANT}[jmt]['’](?=\\p{L})`, "giu"),
  nombresRe: /(?<![\p{L}\p{N}])\d[\d   .,]*%?(?![\p{L}\p{N}])|€\s?\d/gu,
  propresRe: /(?<![.!?]\s)(?<!^)(?<![\p{L}])\p{Lu}\p{Ll}{2,}(?![\p{L}])/gmu,
  borne: [HORS_MOT_AVANT, HORS_MOT_APRES],
  compterEspacesDurs: espacesDursNonTypographiques,
  compterCourbes: courbesNonTypographiques,
  seuilsVoix: { contractionsHumain: 1.5 },
};

/* ---------- score d'accroche : langue « fr » ---------- */
export const HOOK_FR: LangueHook = {
  motRe: /[\p{L}\p{N}$%€'’-]+/gu,
  // Nombre français : groupes de trois séparés par une espace (« 18 000 ») = un seul nombre.
  nombreRe: new RegExp(String.raw`(?:€|\$)\s?\d[\d,.]*|(?<![\p{L}\p{N}])\d{1,3}(?:[` + ESP + String.raw`]\d{3})+(?:[,.]\d+)?\s?(?:` + UNITES + String.raw`)?|(?<![\p{L}\p{N}])\d[\d,.]*\s?(?:` + UNITES + ")?", "giu"),
  propreRe: /(?<!^)(?<![\p{L}])\p{Lu}\p{Ll}{2,}(?![\p{L}])/gu,
  hashtagRe: /(?:^|\s)#[\p{L}\p{N}_]+/u,
  emojiRe: /[\u{1F300}-\u{1FAFF}☀-➿]/u,
  nombresParles: new Set(["zéro", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "quinze", "vingt", "trente", "quarante", "cinquante", "soixante", "cent", "cents", "mille", "million", "millions", "milliard", "milliards", "douzaine", "dizaine", "moitié", "double", "triple"]),
  motsArgent: new Set(["euros", "euro", "francs", "fcfa", "balles", "smic", "salaire", "loyer", "bénéfice", "bénéfices", "marge", "chiffre", "facture", "millionnaire", "milliardaire"]),
  enjeu: new Set([
    "arrête", "arrêtez", "stop", "jamais", "faux", "erreur", "erreurs", "perdu", "perdre", "perds", "perte",
    "coûté", "coûte", "coûtent", "coût", "cassé", "raté", "échoué", "échec", "personne", "pas", "rien", "aucun", "aucune",
    "viré", "virée", "supprimé", "supprime", "tué", "tue", "remplacé", "remplace", "coupé", "battu", "gratuit", "gratuite",
    "payé", "payée", "facturé", "embauché", "sauvé", "premier", "première", "interdit", "illégal", "pire",
    "déteste", "gaspillé", "gaspiller", "arnaque", "mensonge", "menti", "vérité", "secret", "caché", "cachée", "volé",
    "avant", "jusqu'à", "mais", "sauf", "sinon", "problème", "risque", "danger", "attention", "regret", "regrette",
    "devrais", "faudrait", "encore", "déjà", "seul", "seule", "seulement", "sans", "contre", "vs", "vraiment",
  ]),
  ouverturesFaibles: [
    "alors", "bon", "ok", "okay", "salut", "coucou", "hello", "bonjour", "hey", "les gars", "bienvenue",
    "aujourd'hui", "en fait", "franchement", "honnêtement", "écoute", "écoutez", "euh", "juste", "je voulais", "je veux",
    "l'un des", "un des", "est-ce que", "vous avez", "tu as", "dans cette", "dans ce", "la chose", "beaucoup de",
    "il y a", "c'est", "en tant que", "quand il", "si vous avez", "tu sais", "vous savez", "voilà",
  ],
  imperatifs: new Set(["arrête", "arrêtez", "vole", "volez", "copie", "copiez", "supprime", "supprimez", "essaie", "essayez", "regarde", "regardez", "lis", "lisez", "enregistre", "enregistrez", "sauvegarde", "utilise", "utilisez", "construis", "fais", "faites", "écris", "écrivez", "envoie", "envoyez", "prends", "prenez", "commence", "commencez", "quitte", "jamais", "toujours", "mets", "mettez", "lance", "lancez", "vérifie", "vérifiez"]),
  redhibitoires: [
    [/^\s*(?:arr[êe]te(?:z)? de scroller|ne scrolle(?:z)? pas)/iu, "Ouvre sur « arrête de scroller ». Réclamer l'attention prouve qu'on ne l'a pas méritée."],
    [mots("dans (?:cette|ce) (?:vidéo|reel)|je vais (?:te|vous) montrer|je vais (?:te|vous) expliquer comment"), "Préambule de vidéo. Supprime-le et ouvre sur le résultat."],
    [/^\s*(?:salut|coucou|bonjour|hello|hey|bienvenue)(?![\p{L}])/iu, "Salutation. Personne n'est venu sur le fil pour être salué."],
    [/(?:^|\s)#[\p{L}\p{N}_]+/u, "Hashtag dans l'accroche. Les hashtags vont en bas de la légende, si on en met."],
    [/[\u{1F300}-\u{1FAFF}☀-➿]/u, "Émoji dans l'accroche. À cette taille d'écran, c'est des mots ou un émoji, pas les deux."],
  ],
  prixRe: /\d[\d   .,]*\s?(?:€|euros?|francs?|fcfa)|€\s?\d/iu,
  toiRe: new RegExp(`${HORS_MOT_AVANT}(?:tu|toi|ton|ta|tes|te|vous|votre|vos)${HORS_MOT_APRES}|${HORS_MOT_AVANT}t['’](?=\\p{L})`, "iu"),
  moiRe: new RegExp(`${HORS_MOT_AVANT}(?:je|moi|mon|ma|mes|me|nous|notre|nos|on)${HORS_MOT_APRES}|${HORS_MOT_AVANT}[jm]['’](?=\\p{L})`, "iu"),
  separateurMilliers: /(?<=\d)[   ,.](?=\d{3}(?!\d))/g,
  libelles: {
    prix: "un prix",
    mots: (n, c, s) => `${n} mots, ${c} caractères, ~${fmt1(s)} s à l'oral (visé : 5 à 12 mots)`,
    concrets: (n, t) => `${n} marqueur(s) concret(s)` + (t ? ` : ${t}` : ""),
    rienConcret: " — aucun chiffre, aucun nom, rien de vérifiable",
    tension: (n, m) => `${n} marqueur(s) de tension` + (m.length ? ` : ${m.join(", ")}` : ""),
    rienEnjeu: " — rien n'est en jeu dans cette phrase",
    vide: "vide",
    aucunPayload: "aucun mot porteur dans la phrase",
    payloadA: (i) => `mot porteur en position ${i}`,
    payloadAvancer: (i) => `mot porteur en position ${i}, à avancer`,
    payloadTard: (i) => `mot porteur en position ${i}, trop tard`,
    ouvertureFaible: (o) => ` ; ouverture faible « ${o} »`,
    parleAuSpectateur: "s'adresse au spectateur",
    imperatif: (w) => `ouverture à l'impératif (« ${w} »)`,
    premierePersonne: "première personne, aucun spectateur nommé",
    troisiemePersonne: "troisième personne, personne dans la pièce",
  },
};
