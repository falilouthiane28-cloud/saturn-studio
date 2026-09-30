/**
 * Nouveautés inspirées des références du propriétaire (Hera, dnyxstudios, Claude) : styles,
 * scènes INTERFACE et LOGO, mot accentué, format 16:9, titres posés au montage.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { STYLES_INTEGRES, lireStyles, promptImage, promptRespecteStyle, segmentsTitre, tonScene, verifierTexteEcran, type Scene, type TypeScene } from "../motion.ts";
import { TEMPLATES_INTEGRES, scenesDuTemplate } from "../motionTemplates.ts";
import { htmlTitre, rendreTitres } from "../../integrations/titresMotion.ts";
import { argsConcat, concatLocal } from "../../integrations/montageMotion.ts";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const TYPES: TypeScene[] = ["HOOK", "CONTEXT", "TENSION", "SOLUTION", "PROOF", "UI", "CTA", "LOGO"];
const scene = (type: TypeScene): Scene => ({ n: 1, type, debut: 0, fin: 3, fond: "white" });

test("R1 · 4 styles intégrés ; chaque prompt a un fond, « motion design », « no text », et le bon cadre", () => {
  assert.deepEqual(Object.keys(STYLES_INTEGRES).sort(), ["clean-explainer", "degrade-doux", "lancement-saas", "produit-3d"]);
  for (const [id, st] of Object.entries(STYLES_INTEGRES))
    for (const t of TYPES) {
      const p9 = promptImage(scene(t), "Un *mot*", st, "9:16");
      assert.ok(promptRespecteStyle(p9), `${id}/${t}`);
      assert.match(p9, /vertical 9:16 frame/);
      assert.match(promptImage(scene(t), "x", st, "16:9"), /horizontal 16:9 frame/);
    }
  assert.equal(tonScene("LOGO", STYLES_INTEGRES["lancement-saas"]), "marque");
  assert.match(promptImage(scene("LOGO"), "Saturn", STYLES_INTEGRES["lancement-saas"]), /violet gradient/);
});

test("R2 · les styles intégrés restent à jour même si motion-styles.json est ancien ; un style perso est conservé", async () => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "styles-"));
  await fs.writeFile(path.join(d, "motion-styles.json"), JSON.stringify({ "clean-explainer": { name: "ancien" }, "mon-style": { name: "Perso", backgrounds: [], accents: ["red"], typography: "", elements: "icons", transitions: "", pacing: "", tension_frame: "" } }));
  const s = await lireStyles(d);
  assert.equal(s["clean-explainer"].name, STYLES_INTEGRES["clean-explainer"].name);
  assert.equal(s["mon-style"].name, "Perso");
  assert.ok(promptRespecteStyle(promptImage(scene("HOOK"), "x", s["mon-style"]))); // repli générique
});

test("R3 · mot accentué : un seul par titre, 6 mots maximum sans compter les astérisques", () => {
  assert.deepEqual(segmentsTitre("Le progrès *ralentit*"), [{ texte: "Le progrès ", accent: false }, { texte: "ralentit", accent: true }]);
  assert.doesNotThrow(() => verifierTexteEcran("un deux trois quatre cinq *six*"));
  assert.throws(() => verifierTexteEcran("*un* et *deux*"), /un seul mot accentué/);
  assert.throws(() => verifierTexteEcran("un deux trois quatre cinq six *sept*"), /6 mots/);
});

test("R4 · 3 templates inspirés des références : INTERFACE en vedette, LOGO final, style dédié", () => {
  const nouveaux = TEMPLATES_INTEGRES.filter((t) => ["demo-produit-20", "decouverte-25", "revelation-15"].includes(t.id));
  assert.equal(nouveaux.length, 3);
  for (const t of nouveaux) {
    assert.ok(t.scenes.some((s) => s.type === "UI"));
    assert.equal(t.scenes[t.scenes.length - 1].type, "LOGO");
    assert.notEqual(t.style, "clean-explainer");
    assert.ok(t.scenes.length <= 5, "peu de coupes, comme les références");
  }
  assert.equal(scenesDuTemplate(nouveaux[0]).at(-1)!.fin, 20);
});

test("R5 · titre HTML : mot accentué coloré, texte échappé, logo plus grand avec halo, titre en haut pour une interface", () => {
  const h = htmlTitre({ texte: "Tout <b>en *un*</b>", ton: "clair", type: "HOOK" }, "9:16", "#7C3AED");
  assert.match(h, /<span style="color:#7C3AED">un<\/span>/);
  assert.match(h, /&lt;b&gt;/);
  const logo = htmlTitre({ texte: "Saturn Studio", ton: "marque", type: "LOGO" }, "16:9", "#7C3AED");
  assert.match(logo, /font-size:104px/); // 1280 × 0,06 × 1,35
  assert.match(logo, /text-shadow:0 0 48px #7C3AED/);
  assert.match(htmlTitre({ texte: "x", ton: "sombre", type: "UI" }, "9:16", "#7C3AED"), /align-items:flex-start/);
});

test("R6 · montage avec titres : PNG en boucle posés avec un fondu, clips sans titre laissés tels quels", () => {
  const a = argsConcat(["a.mp4", "b.mp4", "c.mp4"], "o.mp4", { format: "16:9", titres: ["t1.png", null, "t3.png"] });
  const f = a[a.indexOf("-filter_complex") + 1];
  assert.match(f, /scale=1280:720/);
  assert.match(f, /\[3:v\]format=rgba,fade=t=in/);
  assert.match(f, /\[v0\]\[t0\]overlay/);
  assert.match(f, /\[w0\]\[v1\]\[w2\]concat=n=3/);
  assert.equal(a.filter((x) => x === "-loop").length, 2);
});

test("R7 · vrai rendu : titres Chromium + ffmpeg sur deux clips, image de contrôle extraite", async (t) => {
  try { await run(FFMPEG, ["-version"]); } catch { t.skip("ffmpeg absent"); return; }
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "titres-"));
  const a = path.join(d, "a.mp4"), b = path.join(d, "b.mp4"), out = path.join(d, "final.mp4");
  await run(FFMPEG, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=white:s=720x1280:r=30:d=2", "-pix_fmt", "yuv420p", a]);
  await run(FFMPEG, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "color=c=0x7C3AED:s=720x1280:r=30:d=2", "-pix_fmt", "yuv420p", b]);
  let pngs: (string | null)[];
  try {
    pngs = await rendreTitres([{ texte: "Le progrès *ralentit*", ton: "clair", type: "HOOK" }, { texte: "Saturn Studio", ton: "marque", type: "LOGO" }], "9:16", "#7C3AED", d);
  } catch (e) { t.skip(`Chromium indisponible : ${(e as Error).message.slice(0, 80)}`); return; }
  await concatLocal([a, b], out, { format: "9:16", titres: pngs });
  const controle = process.env.MOTION_CONTROLE ?? path.join(d, "controle.jpg");
  await run(FFMPEG, ["-y", "-loglevel", "error", "-i", out, "-vf", "select='eq(n\\,45)+eq(n\\,105)',scale=240:-1,tile=2x1", "-frames:v", "1", controle]);
  console.log("R7 image de contrôle :", controle);
  assert.ok((await fs.stat(out)).size > 10_000);
});
