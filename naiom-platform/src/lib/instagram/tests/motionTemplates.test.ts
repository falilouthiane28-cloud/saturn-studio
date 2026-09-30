/** Onglets Motion et Templates : templates, parsing du plan, suivi des vidéos (sans réseau ni crédit). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { TEMPLATES_INTEGRES, ajouterTemplate, lireTemplates, scenesDuTemplate, supprimerTemplate, validerTemplate, type TemplateVideo } from "../motionTemplates.ts";
import { lireBrouillon, type MotionPlan } from "../motionPlan.ts";
import { creerJob, lancerJob, listerJobs } from "../motionJobs.ts";

const dossier = () => fs.mkdtemp(path.join(os.tmpdir(), "tpl-"));
const STYLES = ["clean-explainer", "lancement-saas", "produit-3d", "degrade-doux"];

test("T1 · les 8 templates intégrés respectent les règles (HOOK en tête, CTA ou LOGO à la fin, ±2 s, 4 à 7 scènes)", () => {
  assert.equal(TEMPLATES_INTEGRES.length, 8);
  for (const t of TEMPLATES_INTEGRES) assert.deepEqual(validerTemplate(t, STYLES), [], t.id);
  const s = scenesDuTemplate(TEMPLATES_INTEGRES[0]);
  assert.equal(s[0].debut, 0);
  assert.equal(s[s.length - 1].fin, 20);
  assert.equal(s.find((x) => x.type === "TENSION")?.fond, "black");
});

test("T2 · template perso : ajouté, relu, jamais en double, supprimable ; les intégrés ne se suppriment pas", async () => {
  const d = await dossier();
  const t: TemplateVideo = { id: "idee-recue-15", name: "Idée reçue", description: "Démonter une idée reçue.", duree: 15, style: "clean-explainer",
    scenes: [{ type: "HOOK", secondes: 2 }, { type: "TENSION", secondes: 4 }, { type: "SOLUTION", secondes: 6 }, { type: "CTA", secondes: 3 }] };
  await ajouterTemplate(d, t, STYLES);
  assert.equal((await lireTemplates(d)).length, 9);
  await assert.rejects(() => ajouterTemplate(d, t, STYLES), /existe déjà/);
  await assert.rejects(() => supprimerTemplate(d, "explainer-20"), /intégrés/);
  await supprimerTemplate(d, "idee-recue-15");
  assert.equal((await lireTemplates(d)).length, 8);
});

test("T3 · template invalide proposé par l'IA : refusé avec la liste des erreurs", async () => {
  const mauvais = { id: "Mauvais ID", name: "", description: "", duree: 18, style: "neon", scenes: [{ type: "CTA", secondes: 1 }] } as unknown as TemplateVideo;
  const e = validerTemplate(mauvais, STYLES);
  assert.ok(e.length >= 5, e.join(" | "));
  await assert.rejects(async () => ajouterTemplate(await dossier(), mauvais, STYLES), /Template invalide/);
});

test("T4 · plan rendu par Claude : JSON dans un bloc markdown accepté, mauvais nombre de scènes ou formules en double refusés", () => {
  const ok = { sujet: "s", public: "p", cta: "c", points: ["a", "b", "c"], accroches: [{ formula_id: 1, texte: "x" }, { formula_id: 2, texte: "y" }, { formula_id: 3, texte: "z" }], scenes: Array(4).fill({ texte_ecran: "t", narration: "n" }) };
  assert.equal(lireBrouillon("```json\n" + JSON.stringify(ok) + "\n```", 4).scenes.length, 4);
  assert.throws(() => lireBrouillon(JSON.stringify(ok), 6), /6 scènes/);
  assert.throws(() => lireBrouillon(JSON.stringify({ ...ok, accroches: [ok.accroches[0], ok.accroches[0], ok.accroches[1]] }), 4), /3 formules différentes/);
});

test("T5 · suivi : une vidéo créée apparaît en tête ; le lancement exige une confirmation explicite", async () => {
  const d = await dossier();
  const plan = { scenes: [{}, {}, {}, {}], sujet: "Test" } as unknown as MotionPlan;
  const job = await creerJob(d, plan);
  assert.equal(job.statut, "plan");
  assert.equal(job.etapes.length, 4);
  assert.equal((await listerJobs(d))[0].id, job.id);
  await assert.rejects(() => lancerJob(d, job.id, false), /Confirmation requise/);
  assert.equal((await listerJobs(d))[0].statut, "plan"); // rien n'a été lancé
});
