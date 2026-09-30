/** Golden : le portage « en » du détecteur rend exactement la sortie de detect.py. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { runPythonJson, SKILLS_DIR } from "../python.ts";
import { detecter, DETECT_EN, type Lexique } from "../portage/detect.ts";
import { TEXTES_EN, CAPTIONS_EN } from "./fixtures.ts";

const LEX = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, "ig-human", "slop.json"), "utf8")) as Lexique;

for (const [i, texte] of [...TEXTES_EN, ...CAPTIONS_EN.filter(Boolean)].entries()) {
  test(`detect : portage « en » identique au Python (texte ${i + 1})`, async () => {
    const ref = await runPythonJson<Record<string, unknown>>("detect", async (dir) => {
      const f = path.join(dir, "t.txt");
      await fsp.writeFile(f, texte, "utf8");
      return [f, "--json"];
    });
    const { source: _s, ...attendu } = ref;
    assert.deepEqual(detecter(DETECT_EN, texte, LEX), attendu);
  });
}
