/** Parité des outils (anglais) : l'enveloppe TypeScript rend la sortie du script Python d'origine. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { runPythonJson } from "../python.ts";
import { beats, captionLint, detect, hookscore, humanize, passerIgHuman, scoreProfil, lireRubrique, swipe } from "../tools.ts";
import { CAPTIONS_EN, HOOKS_EN, SCRIPTS_EN, TEXTES_EN } from "./fixtures.ts";

test("hookscore (en) = Python, classement décroissant, seuil 50", async () => {
  const r = await hookscore(HOOKS_EN.slice(0, 6), "en");
  const ref = await runPythonJson<{ score: number }[]>("hookscore", async (d) => { const f = path.join(d, "h.txt"); await fs.writeFile(f, HOOKS_EN.slice(0, 6).join("\n")); return [f, "--json"]; });
  assert.deepEqual(r.resultats.map(({ formula_id: _f, ...x }) => x), ref);
  assert.deepEqual(r.classement.map((x) => x.score), [...ref.map((x) => x.score)].sort((a, b) => b - a));
  assert.equal(r.pasEncoreDAccroche, r.classement[0].score < 50);
});

test("beats = Python (avec --target)", async () => {
  for (const s of SCRIPTS_EN) {
    const { fiabilite: _f, ...r } = await beats(s, { target: 30 }, "en");
    assert.deepEqual(r, await runPythonJson("beats", () => ["-", "--json", "--target", "30"], { stdin: s }));
  }
});

test("caption lint = Python (avec --keywords)", async () => {
  for (const c of CAPTIONS_EN.filter(Boolean)) {
    const { fiabilite: _f, ...r } = await captionLint(c, ["hooks", "reels"], "en");
    assert.deepEqual(r, await runPythonJson("caption", () => ["-", "--json", "--keywords", "hooks,reels"], { stdin: c }));
  }
});

test("humanize (en) = Python", async () => {
  for (const t of TEXTES_EN) assert.deepEqual(await humanize(t, "en"), await runPythonJson("humanize", () => ["-", "--json"], { stdin: t }));
});

test("detect (en) = Python", async () => {
  for (const t of TEXTES_EN) {
    const { fiabilite: _f, ...r } = await detect(t, "en");
    const { source: _s, ...ref } = await runPythonJson<Record<string, unknown>>("detect", async (d) => { const f = path.join(d, "t.txt"); await fs.writeFile(f, t); return [f, "--json"]; });
    assert.deepEqual(r, ref);
  }
});

test("ig-human : le texte ET le score, jamais le score seul", async () => {
  const r = await passerIgHuman(TEXTES_EN[0], "en");
  assert.equal(typeof r.text, "string");
  assert.ok(r.text.length > 0);
  assert.equal(typeof r.human_score, "number");
});

test("swipe = Python, attribution obligatoire", async () => {
  const lignes = [{ account: "@a", followers: 48000, median: 11000, views: 412000, hook: "nobody tells you your first 30 flop" }];
  const r = await swipe(lignes, {}, "en");
  const ref = await runPythonJson("swipe", () => ["-", "--json"], { stdin: "account\tfollowers\tmedian\tviews\thook\n@a\t48000\t11000\t412000\tnobody tells you your first 30 flop" });
  assert.deepEqual(r, ref);
  await assert.rejects(swipe([{ account: "", views: 1, hook: "x" }], {}, "en"), /attribuée/);
});

test("score de profil : total sur 100, notes contrôlées contre rubric.json", () => {
  const items = lireRubrique().items;
  const pleines = Object.fromEntries(items.map((i) => [i.id, i.points]));
  assert.equal(scoreProfil(pleines).total, 100);
  assert.throws(() => scoreProfil({ ...pleines, [items[0].id]: items[0].points + 1 }), /hors de/);
  assert.throws(() => scoreProfil({ [items[0].id]: 1 }), /manquante/);
});
