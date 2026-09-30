/**
 * Chargement des skills du pack : texte intégral du SKILL.md + fichiers JSON du dossier, en cache.
 * Chargement progressif : un agent ne reçoit le texte d'un skill que lorsque le routeur
 * l'a choisi. Le modèle suit le SKILL.md tel quel, jamais une paraphrase de mémoire.
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { SKILLS_DIR } from "./python.ts";

export const SKILLS = [
  "ig-reel", "ig-caption", "ig-carousel", "ig-story", "ig-repurpose", "ig-comment", "ig-reply", "ig-dm",
  "ig-human", "ig-viral", "ig-audit", "ig-plan", "ig-profile",
] as const;
export type SkillName = (typeof SKILLS)[number];

export interface Skill {
  name: SkillName;
  description: string;
  texte: string; // SKILL.md complet, octet pour octet
  assets: Record<string, unknown>; // fichiers .json du dossier (hooks.json, slop.json, rubric.json…)
  scripts: string[]; // scripts .py du dossier
}

const cache = new Map<SkillName, Skill>();

export function loadSkill(name: SkillName): Skill {
  if (!SKILLS.includes(name)) throw new Error(`Skill inconnu : ${name}`);
  const hit = cache.get(name);
  if (hit) return hit;
  const dir = path.join(SKILLS_DIR, name);
  const texte = fs.readFileSync(path.join(dir, "SKILL.md"), "utf8");
  const fm = matter(texte).data as { name?: string; description?: string };
  const fichiers = fs.readdirSync(dir);
  const skill: Skill = {
    name,
    description: String(fm.description ?? "").trim(),
    texte,
    assets: Object.fromEntries(fichiers.filter((f) => f.endsWith(".json")).map((f) => [f, JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))])),
    scripts: fichiers.filter((f) => f.endsWith(".py")),
  };
  cache.set(name, skill);
  return skill;
}

/** Nom + description de chaque skill (sans le corps) : ce que voit le routeur. */
export function listSkills(): { name: SkillName; description: string }[] {
  return SKILLS.map((n) => ({ name: n, description: loadSkill(n).description }));
}
