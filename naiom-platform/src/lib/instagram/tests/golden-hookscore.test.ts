/**
 * Golden : le portage TypeScript du score d'accroche (langue "en") doit rendre exactement
 * la sortie JSON de hookscore.py. Le Python est la référence : s'ils diffèrent, le portage a tort.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { runPythonJson } from "../python.ts";
import { scoreHook } from "../portage/hookscore.ts";
import { HOOK_EN } from "../portage/hookscoreEn.ts";
import { HOOKS_EN } from "./fixtures.ts";

test("hookscore : portage « en » identique au Python sur les 46 accroches", async () => {
  const ref = await runPythonJson<unknown[]>("hookscore", async (dir) => {
    const f = path.join(dir, "hooks.txt");
    await fs.writeFile(f, HOOKS_EN.join("\n"), "utf8");
    return [f, "--json"];
  });
  assert.equal(ref.length, HOOKS_EN.length);
  HOOKS_EN.forEach((h, i) => assert.deepEqual(scoreHook(HOOK_EN, h), ref[i], `accroche n°${i + 1} : ${h}`));
});
