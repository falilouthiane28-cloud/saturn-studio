/**
 * Classement des accroches.
 *  - anglais : golden contre classify() de swipe.py (la référence, y compris ses limites) ;
 *  - français (ajout Saturn) : chaque exemple doit être reconnu comme sa propre formule.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { classer, formules } from "../hooks.ts";
import { PYTHON, SKILLS_DIR } from "../python.ts";
import { HOOKS_EN } from "./fixtures.ts";

test("les 26 formules existent en anglais et en français, mêmes ids", () => {
  const { en, fr } = formules();
  assert.equal(en.length, 26);
  assert.deepEqual(fr.map((f) => f.id).sort((a, b) => a - b), en.map((f) => f.id).sort((a, b) => a - b));
});

test("anglais : même formule que classify() de swipe.py sur 72 accroches", () => {
  const accroches = [...formules().en.map((f) => f.example), ...HOOKS_EN];
  const script = [
    "import json, sys",
    `sys.path.insert(0, ${JSON.stringify(path.join(SKILLS_DIR, "ig-viral"))})`,
    "import swipe",
    `F = swipe.load_formulas(${JSON.stringify(path.join(SKILLS_DIR, "ig-reel", "hooks.json"))})`,
    "print(json.dumps([swipe.classify(h, F)[0] for h in json.loads(sys.stdin.read())]))",
  ].join("\n");
  const ref = JSON.parse(execFileSync(PYTHON, ["-c", script], { input: JSON.stringify(accroches), env: { ...process.env, PYTHONUTF8: "1" } }).toString()) as (number | null)[];
  assert.deepEqual(accroches.map((a) => classer(a, "en")), ref);
});

test("français : chaque exemple est classé dans sa formule", () => {
  const erreurs = formules().fr.filter((f) => classer(f.example, "fr") !== f.id).map((f) => `#${f.id} « ${f.example} » → ${classer(f.example, "fr")}`);
  assert.deepEqual(erreurs, []);
});
