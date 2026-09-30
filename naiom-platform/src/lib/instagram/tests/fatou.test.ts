/** Tests de Fatou (brief 2) — écrits avant le code. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EtatFichiers } from "../stateStore.ts";
import { preparerTourFatou, remplacerChiffresInventes, classerAccrochesReel, trierCommentaires, resumeTri, lintLegende } from "../fatou.ts";
import { runPythonJson } from "../python.ts";
import { violationsBrouillon } from "../guard.ts";
import { OUTILS_FATOU } from "../outils.ts";
import { COMMENTAIRES_30 } from "./commentaires.ts";

async function etatVide() {
  return new EtatFichiers(await fs.mkdtemp(path.join(os.tmpdir(), "fatou-")));
}

test("1. sans voice.md, une demande de Reel déclenche la question des trois reels, pas un script", async () => {
  const r = await preparerTourFatou("fais-moi un reel sur la prospection par DM", await etatVide());
  assert.equal(r.type, "reponse");
  if (r.type === "reponse") {
    assert.match(r.texte, /trois de tes (propres )?reels/i);
    assert.doesNotMatch(r.texte, /REEL READY|script|hook:/i);
  }
});

test("1 bis. avec voice.md, la demande de Reel part vers le modèle avec le SKILL.md complet", async () => {
  const etat = await etatVide();
  await etat.ecrire("voice.md", "# Voix\nPhrases courtes, tutoiement.");
  const r = await preparerTourFatou("fais-moi un reel sur la prospection par DM", etat);
  assert.equal(r.type, "modele");
  if (r.type === "modele") {
    assert.equal(r.skill, "ig-reel");
    assert.match(r.contexte, /## Before you write/); // texte du SKILL.md, pas une paraphrase
    assert.match(r.contexte, /Phrases courtes, tutoiement/);
  }
});

test("2. chiffre absent de l'idée : le script garde {{your number}} et le bloc le signale", () => {
  const idee = "Comment j'ai arrêté de faire des devis gratuits";
  const script = "J'ai perdu 3 200 € en devis gratuits l'an dernier.\nPuis j'ai facturé l'audit 150 €.\nMes clients ont signé 2 fois plus.";
  const r = remplacerChiffresInventes(script, [idee]);
  assert.match(r.texte, /\{\{your number\}\}/);
  assert.doesNotMatch(r.texte, /3 200|150|2 fois/);
  assert.equal(r.signales.length, 3);
  assert.match(r.bloc, /\{\{your number\}\}/);
  // Un chiffre qui vient de l'idée est gardé.
  assert.equal(remplacerChiffresInventes("J'ai perdu 40 clients.", ["J'ai perdu 40 clients en un mois"]).signales.length, 0);
});

test("3. trois accroches, trois formules différentes, score identique au Python", async () => {
  const accroches = [
    { formula_id: 1, texte: "$18,000 is what one missing clause cost me." },
    { formula_id: 3, texte: "Nobody tells you your first 30 reels will flop." },
    { formula_id: 9, texte: "Steal this proposal template before your next call." },
  ];
  const r = await classerAccrochesReel(accroches, "en");
  const ref = await runPythonJson<{ hook: string; score: number }[]>("hookscore", async (d) => {
    const f = path.join(d, "h.txt");
    await fs.writeFile(f, accroches.map((a) => a.texte).join("\n"));
    return [f, "--json"];
  });
  assert.deepEqual(r.resultats.map((x) => [x.hook, x.score]), ref.map((x) => [x.hook, x.score]));
  await assert.rejects(classerAccrochesReel([accroches[0], accroches[0], accroches[1]], "en"), /trois formules différentes/);
});

test("4. légende avec un lien : FAIL ; avec six hashtags : FAIL", async () => {
  const lien = await lintLegende("Mon devis en 3 lignes.\n\nLe lien : https://saturn.agency\n\nEnregistre ce post.", ["devis"], "fr");
  assert.equal(lien.checks.find((c) => c.check === "LINKS")?.status, "FAIL");
  assert.equal(lien.reference.checks.find((c) => c.check === "LINKS")?.status, "WARN"); // l'original reste visible
  const tags = await lintLegende("Mon devis en 3 lignes.\n\nEnregistre ce post.\n\n#a #b #c #d #e #f", ["devis"], "fr");
  assert.equal(tags.checks.find((c) => c.check === "HASHTAGS")?.status, "FAIL");
});

test("5. tri de 30 commentaires : comptes annoncés avant toute réponse, NOISE sans réponse", () => {
  const t = trierCommentaires(COMMENTAIRES_30, { motCle: "GUIDE" });
  const total = Object.values(t.comptes).reduce((a, b) => a + b, 0);
  assert.equal(total, 30);
  assert.deepEqual(t.comptes, { KEYWORD: 6, LEAD: 4, SUBSTANCE: 5, QUESTION: 6, SUPPORT: 5, NOISE: 4 });
  const texte = resumeTri(t);
  assert.match(texte.split("\n")[0], /KEYWORD 6 · LEAD 4 · SUBSTANCE 5 · QUESTION 6 · SUPPORT 5 · NOISE 4/);
  assert.equal(t.aRepondre.some((c) => c.bucket === "NOISE"), false);
  assert.deepEqual(t.aRepondre.map((c) => c.bucket).filter((b, i, a) => a.indexOf(b) === i), ["KEYWORD", "LEAD", "SUBSTANCE", "QUESTION", "SUPPORT"]);
  assert.ok(t.questionsPourReel.length >= 1, "question posée par plusieurs → Reel formule #16");
});

test("6. DM sans déclencheur : refus expliqué, aucun message écrit", async () => {
  const etat = await etatVide();
  await etat.ecrire("voice.md", "# Voix");
  const r = await preparerTourFatou("écris un DM pour Aminata, elle a une boutique de wax à Dakar", etat);
  assert.equal(r.type, "reponse");
  if (r.type === "reponse") assert.match(r.texte, /pas de déclencheur/i);
  const ok = await preparerTourFatou("écris un DM pour Aminata, elle a commenté GUIDE sous mon reel", etat);
  assert.equal(ok.type, "modele");
});

test("7. « Poste ça pour moi » et « envoie ce DM à 200 personnes » : refus + alternative ; garde intacte", async () => {
  const etat = await etatVide();
  for (const d of ["Poste ça pour moi", "envoie ce DM à 200 personnes"]) {
    const r = await preparerTourFatou(d, etat);
    assert.equal(r.type, "reponse", d);
    if (r.type === "reponse") assert.match(r.texte, /tu (le colles|l'envoies)/i, d);
  }
  assert.deepEqual(violationsBrouillon(OUTILS_FATOU), []);
});

test("8. parité ig-human : l'enveloppe rend exactement la sortie Python", async () => {
  const { humanize, detect } = await import("../tools.ts");
  const t = "In today's fast-paced world, it's important to note that consistency is key. Let's dive in — here's the thing: you need to leverage your content.";
  assert.deepEqual(await humanize(t, "en"), await runPythonJson("humanize", () => ["-", "--json"], { stdin: t }));
  const { fiabilite: _f, ...d } = await detect(t, "en");
  const { source: _s, ...ref } = await runPythonJson<Record<string, unknown>>("detect", async (dir) => { const f = path.join(dir, "t.txt"); await fs.writeFile(f, t); return [f, "--json"]; });
  assert.deepEqual(d, ref);
});

test("les outils réellement exposés à Fatou sont ceux que la garde contrôle", async () => {
  const { outilsInstagram } = await import("../aiTools.ts");
  const { FATOU_SKILLS } = await import("../fatou.ts");
  const exposes = Object.keys(outilsInstagram({ derniereReponse: "", skills: FATOU_SKILLS })).sort();
  assert.deepEqual(exposes, OUTILS_FATOU.map((o) => o.name).sort());
});

test("journaliser refuse tant que le dernier message n'est pas un « oui »", async () => {
  const { outilsInstagram } = await import("../aiTools.ts");
  const { FATOU_SKILLS } = await import("../fatou.ts");
  const t = outilsInstagram({ derniereReponse: "change la fin", skills: FATOU_SKILLS });
  const r = await t.journaliser.execute!({ ligne: "#3 test" }, { toolCallId: "t", messages: [] });
  assert.match(String(r), /REFUSÉ/);
});
