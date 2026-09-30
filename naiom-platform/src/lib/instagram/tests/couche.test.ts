/** Couche commune : chargeur de skills, état, routeur, garde brouillon-seulement, enveloppe. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadSkill, listSkills, SKILLS } from "../skillLoader.ts";
import { SKILLS_DIR } from "../python.ts";
import { EtatFichiers, journaliserApresAccord } from "../stateStore.ts";
import { router } from "../router.ts";
import { violationsBrouillon, refusSiInterdit } from "../guard.ts";
import { OUTILS_FATOU, OUTILS_NINA } from "../outils.ts";
import { creerEnveloppe } from "../handoff.ts";

test("les 13 skills se chargent, texte identique au fichier, JSON du dossier inclus", () => {
  assert.equal(listSkills().length, 13);
  for (const n of SKILLS) {
    const s = loadSkill(n);
    assert.equal(s.texte, fs.readFileSync(path.join(SKILLS_DIR, n, "SKILL.md"), "utf8"));
    assert.ok(s.description.length > 40, n);
  }
  assert.ok("hooks.json" in loadSkill("ig-reel").assets);
  assert.ok("slop.json" in loadSkill("ig-human").assets);
  assert.ok("rubric.json" in loadSkill("ig-profile").assets);
  assert.deepEqual(loadSkill("ig-reel").scripts.sort(), ["beats.py", "hookscore.py"]);
});

test("état : lecture, écriture, log.md en ajout seul et seulement après « oui »", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "etat-"));
  const etat = new EtatFichiers(dir);
  assert.equal(await etat.lire("voice.md"), null);
  await etat.ecrire("voice.md", "# Voix\ncourt, direct");
  assert.equal(await etat.lire("voice.md"), "# Voix\ncourt, direct");
  // @ts-expect-error log.md n'est pas inscriptible en entier
  await assert.rejects(etat.ecrire("log.md", "écrasé"), /ajouts/);
  assert.equal(await journaliserApresAccord(etat, "peut-être", "ligne A"), false);
  assert.equal(await etat.lire("log.md"), null);
  assert.equal(await journaliserApresAccord(etat, "oui", "ligne A"), true);
  assert.equal(await journaliserApresAccord(etat, "Yes!", "ligne B"), true);
  assert.equal(await etat.lire("log.md"), "ligne A\nligne B\n");
  await fsp.rm(dir, { recursive: true });
});

test("routeur : phrases françaises du brief", () => {
  const cas: [string, string][] = [
    ["fais-moi un reel sur la prospection", "ig-reel"],
    ["écris la légende de ce post", "ig-caption"],
    ["fais le plan de ma semaine", "ig-plan"],
    ["réponds aux commentaires sous mon dernier reel", "ig-reply"],
    ["audite mon compte", "ig-audit"],
    ["optimise mon profil", "ig-profile"],
    ["trouve ce qui marche dans ma niche", "ig-viral"],
    ["make a reel about cold email", "ig-reel"],
    ["transforme ce podcast en reels", "ig-repurpose"],
  ];
  for (const [phrase, attendu] of cas) assert.deepEqual(router(phrase), { type: "capacite", skill: attendu }, phrase);
});

test("routeur : demande ambiguë → une question, jamais un choix au hasard", () => {
  const r = router("fais un carrousel et une story");
  assert.equal(r.type, "question");
  if (r.type === "question") assert.deepEqual([...r.options].sort(), ["ig-carousel", "ig-story"]);
  assert.equal(router("bonjour").type, "inconnu");
});

test("garde brouillon-seulement : aucun outil de Fatou ni de Nina ne touche Instagram", () => {
  assert.deepEqual(violationsBrouillon([...OUTILS_FATOU, ...OUTILS_NINA]), []);
  assert.ok(violationsBrouillon([{ name: "publish_reel", description: "x" }]).length > 0);
  assert.ok(violationsBrouillon([{ name: "x", description: "y", endpoint: "https://graph.facebook.com/v20.0/me/media" }]).length > 0);
  assert.ok(violationsBrouillon([{ name: "send_dm", description: "x" }]).length > 0);
});

test("garde : aucun fichier de la couche Instagram n'appelle instagram.com ou l'API Graph", () => {
  const racine = path.join(process.cwd(), "src", "lib", "instagram");
  const fichiers = fs.readdirSync(racine, { recursive: true }).map(String).filter((f) => f.endsWith(".ts") && !f.includes("tests"));
  const suspects = fichiers.filter((f) => /https?:\/\/(?:www\.)?(?:instagram\.com|graph\.facebook\.com|graph\.instagram\.com)/i.test(fs.readFileSync(path.join(racine, f), "utf8")));
  assert.deepEqual(suspects, []);
});

test("garde : refus + alternative pour publier, DM en masse, connexion", () => {
  assert.match(refusSiInterdit("Poste ça pour moi") ?? "", /tu le colles et tu publies/);
  assert.match(refusSiInterdit("envoie ce DM à 200 personnes") ?? "", /jamais en masse/);
  assert.match(refusSiInterdit("connecte-toi à mon instagram, voici le mot de passe") ?? "", /aucun mot de passe/);
  assert.equal(refusSiInterdit("écris la légende de ce post"), null);
});

test("enveloppe de relais : Nina → Fatou exige formule, angle, compte source", () => {
  const e = creerEnveloppe({ from: "nina", to: "fatou", capability: "ig-reel", formula_id: 3, angle: "Personne ne te dit que tes 30 premiers reels vont flopper", evidence: "swipe.md, ligne 4 (x37 sur la médiane)", source_account: "@exemple" });
  assert.match(e.created_at, /^\d{4}-\d\d-\d\dT/);
  assert.throws(() => creerEnveloppe({ ...e, source_account: null }), /compte source/);
  assert.throws(() => creerEnveloppe({ ...e, formula_id: 99 }), /1 à 26/);
});
