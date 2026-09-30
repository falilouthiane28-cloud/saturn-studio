/**
 * Templates de vidéos motion design : une durée, une suite de scènes typées (HOOK… CTA/LOGO) et un
 * style. Huit templates intégrés ; ceux créés par le propriétaire (ou par Fatou à sa demande)
 * vont dans motion-templates.json, dans le dossier d'état Instagram.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { FOND, type Duree, type Scene, type TypeScene } from "./motion.ts";

export interface TemplateVideo {
  id: string;
  name: string;
  description: string;
  duree: Duree;
  scenes: { type: TypeScene; secondes: number }[];
  style: string;
  builtin?: boolean;
}

const T = (id: string, name: string, description: string, duree: Duree, seq: [TypeScene, number][], style = "clean-explainer"): TemplateVideo =>
  ({ id, name, description, duree, scenes: seq.map(([type, secondes]) => ({ type, secondes })), style, builtin: true });

export const TEMPLATES_INTEGRES: TemplateVideo[] = [
  T("explainer-20", "Explainer", "Le format complet : accroche, contexte, tension, solution, preuve, appel à l'action.", 20,
    [["HOOK", 2], ["CONTEXT", 4], ["TENSION", 4], ["SOLUTION", 5], ["PROOF", 3], ["CTA", 2]]),
  T("astuce-15", "Astuce", "Une astuce, droit au but : le problème, la solution, l'appel à l'action.", 15,
    [["HOOK", 2], ["TENSION", 4], ["SOLUTION", 6], ["CTA", 3]]),
  T("avant-apres-25", "Avant / après", "Montrer la transformation : la situation avant, le déclic, le résultat.", 25,
    [["HOOK", 2], ["CONTEXT", 5], ["TENSION", 3], ["SOLUTION", 8], ["PROOF", 4], ["CTA", 3]]),
  T("offre-20", "Offre", "Présenter un service : le problème du client, l'offre, la preuve, comment l'obtenir.", 20,
    [["HOOK", 2], ["TENSION", 4], ["SOLUTION", 6], ["PROOF", 4], ["CTA", 4]]),
  T("lancement-30", "Lancement", "Annoncer un produit ou un service en racontant l'histoire complète.", 30,
    [["HOOK", 2], ["CONTEXT", 4], ["TENSION", 4], ["SOLUTION", 7], ["PROOF", 5], ["PROOF", 5], ["CTA", 3]]),
  // Inspirés des références du propriétaire (Hera, Claude, Claude.ai) : peu de coupes, l'interface en vedette, logo final.
  T("demo-produit-20", "Démo produit", "Montrer un outil en action : la question tapée, l'interface qui répond, le résultat, le logo.", 20,
    [["HOOK", 3], ["UI", 5], ["UI", 4], ["PROOF", 4], ["LOGO", 4]], "lancement-saas"),
  T("decouverte-25", "Découverte", "Faire découvrir un produit : l'invitation, l'écran en perspective, la liste de ce qu'il fait, la gamme, le logo.", 25,
    [["HOOK", 3], ["UI", 6], ["PROOF", 6], ["SOLUTION", 6], ["LOGO", 4]], "degrade-doux"),
  T("revelation-15", "Révélation de marque", "Une scène 3D sombre et lumineuse qui mène au produit puis au logo.", 15,
    [["HOOK", 3], ["CONTEXT", 4], ["UI", 4], ["LOGO", 4]], "produit-3d"),
];

const TYPES: TypeScene[] = ["HOOK", "CONTEXT", "TENSION", "SOLUTION", "PROOF", "UI", "CTA", "LOGO"];

/** Règles communes à tous les templates (intégrés ou créés). Renvoie la liste des erreurs. */
export function validerTemplate(t: TemplateVideo, stylesDispo: string[]): string[] {
  const e: string[] = [];
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t.id ?? "")) e.push("identifiant : minuscules et tirets");
  if (!t.name?.trim() || t.name.length > 40) e.push("nom : 1 à 40 caractères");
  if (![15, 20, 25, 30].includes(t.duree)) e.push("durée : 15, 20, 25 ou 30 s");
  if (!Array.isArray(t.scenes) || t.scenes.length < 4 || t.scenes.length > 7) e.push("4 à 7 scènes");
  else {
    if (t.scenes.some((s) => !TYPES.includes(s.type))) e.push(`types de scène : ${TYPES.join(", ")}`);
    if (t.scenes.some((s) => !(s.secondes >= 1.5 && s.secondes <= 10))) e.push("chaque scène : 1,5 à 10 s");
    if (t.scenes[0].type !== "HOOK") e.push("la première scène est le HOOK");
    if (!["CTA", "LOGO"].includes(t.scenes[t.scenes.length - 1].type)) e.push("la dernière scène est le CTA ou le LOGO");
    const total = t.scenes.reduce((a, s) => a + s.secondes, 0);
    if (total < t.duree - 2 || total > t.duree + 2) e.push(`total des scènes (${total} s) à ±2 s de la durée`);
  }
  if (!stylesDispo.includes(t.style)) e.push(`style inconnu : ${t.style}`);
  return e;
}

/** Scènes horodatées d'un template (mêmes fonds que le découpage standard). */
export function scenesDuTemplate(t: TemplateVideo): Scene[] {
  let debut = 0;
  return t.scenes.map((s, i) => { const sc = { n: i + 1, type: s.type, debut, fin: debut + s.secondes, fond: FOND[s.type] }; debut += s.secondes; return sc; });
}

const FICHIER = "motion-templates.json";

export async function lireTemplates(dossier: string): Promise<TemplateVideo[]> {
  try {
    const perso = JSON.parse(await fs.readFile(path.join(dossier, FICHIER), "utf8")) as TemplateVideo[];
    return [...TEMPLATES_INTEGRES, ...perso.map((t) => ({ ...t, builtin: false }))];
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [...TEMPLATES_INTEGRES];
    throw e;
  }
}

async function ecrirePerso(dossier: string, liste: TemplateVideo[]) {
  await fs.mkdir(dossier, { recursive: true });
  const f = path.join(dossier, FICHIER);
  await fs.writeFile(`${f}.tmp`, JSON.stringify(liste.map(({ builtin: _b, ...t }) => t), null, 2), "utf8");
  await fs.rename(`${f}.tmp`, f);
}

export async function ajouterTemplate(dossier: string, t: TemplateVideo, stylesDispo: string[]): Promise<TemplateVideo> {
  const erreurs = validerTemplate(t, stylesDispo);
  if (erreurs.length) throw new Error(`Template invalide : ${erreurs.join(" ; ")}`);
  const tous = await lireTemplates(dossier);
  if (tous.some((x) => x.id === t.id)) throw new Error(`Le template ${t.id} existe déjà.`);
  const propre: TemplateVideo = { id: t.id, name: t.name.trim(), description: (t.description ?? "").trim().slice(0, 200), duree: t.duree, scenes: t.scenes, style: t.style };
  await ecrirePerso(dossier, [...tous.filter((x) => !x.builtin), propre]);
  return { ...propre, builtin: false };
}

export async function supprimerTemplate(dossier: string, id: string): Promise<void> {
  const tous = await lireTemplates(dossier);
  const cible = tous.find((x) => x.id === id);
  if (!cible) throw new Error("Template introuvable.");
  if (cible.builtin) throw new Error("Les templates intégrés ne se suppriment pas.");
  await ecrirePerso(dossier, tous.filter((x) => !x.builtin && x.id !== id));
}
