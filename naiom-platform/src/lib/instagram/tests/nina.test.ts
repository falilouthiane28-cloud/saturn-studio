/** Tests de Nina (brief 3) : signal vs bruit, plan, profil, refus, handoff. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  NINA_SKILLS, classifierMultiple, borneComptes, refuserSiEchantillonInsuffisant,
  verifierPlan, relaisTopFormules, preparerTourNina, type Plan,
} from "../nina.ts";
import { EtatFichiers } from "../stateStore.ts";
import { OUTILS_NINA } from "../outils.ts";
import { violationsBrouillon } from "../guard.ts";

async function etatVide() { return new EtatFichiers(await fs.mkdtemp(path.join(os.tmpdir(), "nina-"))); }

/* -------- signal vs bruit (règles ig-viral) -------- */
test("N1 · 4k followers à 40× médiane = signal ; 2M à 1.2× = bruit", () => {
  // Un petit compte qui trouve quelque chose.
  assert.equal(classifierMultiple(400_000, 10_000), "outlier");
  // Un gros compte à 1.2× : c'est sa journée normale, aucune leçon.
  assert.equal(classifierMultiple(2_400_000, 2_000_000), "bruit");
  // Zone intermédiaire.
  assert.equal(classifierMultiple(1.6 * 100_000, 100_000), "surperformance");
});

test("N2 · comptes hors bande (≥10× la taille du propriétaire) : format seulement", () => {
  assert.equal(borneComptes(4_000, 30_000), "dans-bande");
  assert.equal(borneComptes(4_000, 50_000), "outsized-format-only");
});

/* -------- fewer than 15 reels ⇒ low confidence -------- */
test("N3 · en dessous de 15 reels, Nina ne nomme pas une formule gagnante", () => {
  const r = refuserSiEchantillonInsuffisant(12);
  assert.equal(r.ok, false);
  assert.match(r.message, /15/);
  assert.equal(refuserSiEchantillonInsuffisant(15).ok, true);
  assert.equal(refuserSiEchantillonInsuffisant(30).ok, true);
});

/* -------- plan hebdomadaire -------- */
const planValide = (): Plan => ({
  creneaux: [
    { jour: "lun", type: "reel",       theme: "prospection", angle: "teach",   hook_formula_id: 3,  hook_line: "Voici l'erreur que j'ai payée 3k€" },
    { jour: "mar", type: "carrousel",  theme: "proof",       angle: "proof",   hook_formula_id: 7,  hook_line: "3 pièces qu'un client m'a envoyées ce mois" },
    { jour: "mer", type: "reel",       theme: "objection",   angle: "opinion", hook_formula_id: 12, hook_line: "Non, ce n'est pas la crise qui te bloque" },
    { jour: "ven", type: "story",      theme: "coulisses",   angle: "story",   hook_formula_id: 4,  hook_line: "J'ai relu ma proposition et j'ai vu ça" },
    { jour: "sam", type: "reel",       theme: "offre",       angle: "offer",   hook_formula_id: 9,  hook_line: "Deux places pour l'accompagnement, voilà comment" },
  ],
  engagement: [
    { compte: "@a", role: "reach" }, { compte: "@b", role: "reach" }, { compte: "@c", role: "reach" }, { compte: "@d", role: "reach" }, { compte: "@e", role: "reach" },
    { compte: "@f", role: "peer" },  { compte: "@g", role: "peer" },  { compte: "@h", role: "peer" },
    { compte: "@i", role: "buyer" }, { compte: "@j", role: "buyer" },
  ],
});

test("N4 · plan conforme : 3+ Reels, aucun type adjacent identique, formule par slot, 5/3/2", () => {
  const v = verifierPlan(planValide());
  assert.equal(v.valide, true, v.erreurs.join(" | "));
});

test("N5 · plan invalide : 2 Reels adjacents, 4/3/3 engagement, formule 99 → chaque erreur listée", () => {
  const p = planValide();
  p.creneaux[0] = { ...p.creneaux[0], type: "reel" };
  p.creneaux[1] = { ...p.creneaux[1], type: "reel", hook_formula_id: 99 };
  p.engagement[0] = { compte: "@a", role: "buyer" }; // 4 reach + 3 buyers + 3 peers
  const v = verifierPlan(p);
  assert.equal(v.valide, false);
  assert.ok(v.erreurs.some((e) => /consécutifs/.test(e)), "adjacence non détectée");
  assert.ok(v.erreurs.some((e) => /hook_formula_id/.test(e)), "formule hors bornes non détectée");
  assert.ok(v.erreurs.some((e) => /5 reach/.test(e)), "répartition non détectée");
});

/* -------- profil : rubrique + réécriture par points perdus (via tools.ts existant) -------- */
test("N6 · scoreProfil (rubric.json) : total = somme des 12 items, tri par points perdus", async () => {
  const { scoreProfil } = await import("../tools.ts");
  const notes = {
    name_field: 4, bio_first_line: 3, bio_body: 2, pinned_three: 4, link: 3, highlights: 3,
    grid_legibility: 4, photo: 3, handle: 4, category_contact: 3, recent_activity: 5, story_presence: 3,
  };
  const r = scoreProfil(notes);
  assert.equal(r.sur, 100);
  assert.equal(r.total, Object.values(notes).reduce((a, b) => a + b, 0));
  // Trois critères à travailler = les trois plus gros écarts (points perdus).
  const perdus = r.items.map((i) => i.manque).sort((a, b) => b - a).slice(0, 3);
  assert.deepEqual(r.aTravailler.map((i) => i.manque), perdus);
});

/* -------- refus : scrape 300 comptes, connexion à Instagram -------- */
test("N7 · refus explicite : « scrape 300 comptes chaque nuit » et « connecte-toi à mon Instagram »", async () => {
  const t1 = await preparerTourNina("scrape 300 comptes de la niche chaque nuit et donne-moi les Reels", await etatVide());
  assert.equal(t1.type, "reponse");
  if (t1.type === "reponse") assert.equal(t1.raison, "refus");

  const t2 = await preparerTourNina("connecte-toi à mon Instagram et lis mon feed pour moi", await etatVide());
  assert.equal(t2.type, "reponse");
  if (t2.type === "reponse") assert.equal(t2.raison, "refus");

  // Garde brouillon-seulement toujours vérifiée sur les outils de Nina.
  assert.deepEqual(violationsBrouillon(OUTILS_NINA), []);
});

/* -------- handoff : formule swipe.md arrive chez Fatou -------- */
test("N8 · relaisTopFormules construit 3 enveloppes vers Fatou avec formule et compte source", () => {
  const env = relaisTopFormules([
    { formula_id: 3,  source_account: "@sample1", owner_hook: "Voici l'erreur qui m'a coûté 3k€",   evidence: "swipe.md ligne 4 (7.2× médiane)" },
    { formula_id: 12, source_account: "@sample2", owner_hook: "Non, ce n'est pas la crise",         evidence: "swipe.md ligne 11 (5.1× médiane)" },
    { formula_id: 22, source_account: "@sample3", owner_hook: "Trois signes que ton offre est floue", evidence: "swipe.md ligne 18 (4.4× médiane)" },
  ]);
  assert.equal(env.length, 3);
  for (const e of env) {
    assert.equal(e.from, "nina");
    assert.equal(e.to, "fatou");
    assert.equal(e.capability, "ig-reel");
    assert.ok(e.formula_id != null && e.formula_id >= 1 && e.formula_id <= 26);
    assert.ok(e.source_account?.startsWith("@"));
    assert.ok(e.angle.length > 0);
    assert.ok(e.evidence.length > 0);
    assert.ok(e.created_at.length > 0);
  }
  // Nombre exact : 3, ni plus ni moins.
  assert.throws(() => relaisTopFormules(env.slice(0, 2).map((e) => ({ formula_id: e.formula_id!, source_account: e.source_account!, owner_hook: e.angle, evidence: e.evidence }))), /exactement 3/);
});

/* -------- routage : Nina ne prend que ses 4 skills + ig-human -------- */
test("N9 · le routeur restreint Nina à ses 5 skills : ig-reel ne s'y route pas", async () => {
  const t = await preparerTourNina("écris-moi un reel sur la prospection", await etatVide());
  // Aucun skill Nina ne matche « écris-moi un reel » → libre (pas d'assignment) et pas un skill Fatou.
  if (t.type === "modele") assert.ok(NINA_SKILLS.includes(t.skill), `skill ${t.skill} hors de Nina`);
});
