/** Sound design et titres animés des vidéos motion design (vrai ffmpeg + Chromium quand disponibles). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { argsMix, planSon, sonoriser, genererSfx, type SceneSon } from "../../integrations/sonMotion.ts";
import { animationPar, htmlTitre, imagesAnimation, longueurTitre } from "../../integrations/titresMotion.ts";
import { argsConcat, monterLocal } from "../../integrations/montageMotion.ts";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
const FFPROBE = FFMPEG.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1");
async function ffmpegDispo() { try { await run(FFMPEG, ["-version"]); return true; } catch { return false; } }

const SCENES: SceneSon[] = [
  { type: "HOOK", debut: 0, fin: 3, aTitre: true, frappes: [0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7] },
  { type: "TENSION", debut: 3, fin: 6, aTitre: true },
  { type: "UI", debut: 6, fin: 10, aTitre: true, frappes: [0.3, 0.35, 0.4] },
  { type: "LOGO", debut: 10, fin: 14, aTitre: true },
];

test("S1 · plan sonore : whoosh à chaque coupe, frappe au rythme des lettres, drone sur la tension, riser → impact → scintillement sur le logo", () => {
  const ev = planSon(SCENES);
  assert.equal(ev.filter((e) => e.sfx === "whoosh").length, 3);
  assert.equal(ev.filter((e) => e.sfx === "tick").length, 13); // 10 lettres de l'accroche + 3 de l'interface
  const drone = ev.find((e) => e.sfx === "drone")!;
  assert.deepEqual([drone.debut, drone.duree], [3, 3]);
  assert.equal(ev.find((e) => e.sfx === "riser")!.debut, 10 - 1.6);
  assert.equal(ev.find((e) => e.sfx === "impact")!.debut, 10);
  assert.ok(ev.find((e) => e.sfx === "shimmer")!.debut > 10);
  assert.ok(ev.some((e) => e.sfx === "pop" && e.debut === 3.25), "pop à l'apparition du titre de la tension");
});

test("S2 · mixage : nappe + effets, narration optionnelle avec baisse automatique, image copiée sans réencodage", () => {
  const sfx = { whoosh: "w.wav", pop: "p.wav", tick: "t.wav", riser: "r.wav", impact: "i.wav", shimmer: "s.wav", drone: "d.wav" };
  const sans = argsMix("v.mp4", sfx, planSon(SCENES), 14, "o.mp4");
  const f = sans[sans.indexOf("-filter_complex") + 1];
  assert.match(f, /amix=inputs=\d+:normalize=0/);
  assert.match(f, /asplit=13/); // les 13 frappes partagent un seul fichier
  assert.doesNotMatch(f, /sidechaincompress/);
  assert.ok(sans.includes("copy"));
  const avec = argsMix("v.mp4", sfx, planSon(SCENES), 14, "o.mp4", "voix.m4a");
  assert.match(avec[avec.indexOf("-filter_complex") + 1], /sidechaincompress/);
});

test("S3 · texte tapé : 18 lettres/s après 0,2 s, curseur qui clignote puis disparaît ; mots : un mot toutes les 0,2 s", () => {
  const t = "Tape ton *idée*";
  const f = imagesAnimation(t, "frappe");
  assert.equal(f.etats.at(-1)!.visibles, longueurTitre(t));
  assert.equal(f.etats.at(-1)!.curseur, false);
  assert.equal(f.frappes.length, longueurTitre(t));
  assert.ok(f.frappes[0] >= 0.2);
  const m = imagesAnimation("Un seul studio suffit", "mots");
  assert.deepEqual(m.frappes, [0.2, 0.4, 0.6, 0.8]);
  assert.equal(animationPar("UI", "clean-explainer"), "frappe");
  assert.equal(animationPar("HOOK", "clean-explainer"), "mots");
  assert.equal(animationPar("HOOK", "lancement-saas"), "frappe");
  assert.equal(animationPar("CTA", "lancement-saas"), "fondu");
});

test("S4 · titre partiel : caractères restants invisibles (mise en page stable), curseur après le dernier visible", () => {
  const h = htmlTitre({ texte: "Salut *toi*", ton: "clair", type: "HOOK" }, "9:16", "#7C3AED", { visibles: 3, curseur: true });
  assert.match(h, /<span>Sal<\/span><span style="display:inline-block;width:0.07em/);
  assert.match(h, /<span style="opacity:0">ut <\/span>/);
  assert.match(h, /<span style="opacity:0;color:#7C3AED">toi<\/span>/);
});

test("S5 · montage : une séquence animée est lue une fois et garde sa dernière image", () => {
  const a = argsConcat(["a.mp4", "b.mp4"], "o.mp4", { titres: [{ kind: "sequence", motif: "t/f_%04d.png", images: 40, frappes: [] }, null] });
  assert.ok(!a.includes("-loop"));
  assert.match(a[a.indexOf("-filter_complex") + 1], /overlay=0:0:eof_action=repeat/);
});

test("S6 · vrai montage : titres animés + sound design, piste audio audible, narration mixée (démo exportée)", async (t) => {
  if (!(await ffmpegDispo())) { t.skip("ffmpeg absent"); return; }
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "son-"));
  const clips: string[] = [];
  for (const [i, [c, s]] of ([["0x1A1A1A", 3], ["white", 3], ["0x7C3AED", 3]] as const).entries()) {
    const f = path.join(d, `c${i}.mp4`);
    await run(FFMPEG, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", `color=c=${c}:s=720x1280:r=30:d=${s}`, "-pix_fmt", "yuv420p", f]);
    clips.push(f);
  }
  let r;
  try {
    r = await monterLocal(clips, path.join(d, "out"), "demo", d, {
      format: "9:16", accent: "#7C3AED",
      titres: [
        { texte: "Tape ton *idée*", ton: "sombre", type: "HOOK", animation: "frappe" },
        { texte: "Un seul studio suffit", ton: "clair", type: "SOLUTION", animation: "mots" },
        { texte: "Saturn Studio", ton: "marque", type: "LOGO", animation: "fondu" },
      ],
    });
  } catch (e) { if (/Chromium|browser|Could not find/i.test((e as Error).message)) { t.skip("Chromium indisponible"); return; } throw e; }
  const info = JSON.parse((await run(FFPROBE, ["-v", "error", "-show_entries", "stream=codec_type:format=duration", "-of", "json", r.finale])).stdout);
  assert.deepEqual(info.streams.map((s: { codec_type: string }) => s.codec_type).sort(), ["audio", "video"]);
  assert.ok(Math.abs(Number(info.format.duration) - 9) < 0.3);
  const vol = (await run(FFMPEG, ["-hide_banner", "-i", r.finale, "-af", "volumedetect", "-f", "null", "-"]).catch((e) => e)).stderr as string;
  const moyen = Number(/mean_volume: (-?[\d.]+) dB/.exec(vol)?.[1]);
  console.log(`S6 volume moyen : ${moyen} dB · durée ${Number(info.format.duration).toFixed(2)} s`);
  assert.ok(moyen > -45, "la piste son n'est pas silencieuse");
  // Narration : une « voix » de test (tonalité modulée) ; la vidéo remixée garde son image.
  const voix = path.join(d, "voix.wav");
  await run(FFMPEG, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "aevalsrc='0.5*sin(2*PI*180*t)*(0.5+0.5*sin(2*PI*3*t))':d=7:s=44100", voix]);
  const avecVoix = path.join(d, "out", "demo-voix.mp4");
  await sonoriser(r.muette, r.scenes_son, r.duree, avecVoix, d, voix);
  assert.ok((await fs.stat(avecVoix)).size > 20_000);
  if (process.env.MOTION_DEMO) {
    await fs.copyFile(r.finale, process.env.MOTION_DEMO);
    await run(FFMPEG, ["-y", "-loglevel", "error", "-i", r.finale, "-vf", "select='eq(n\\,12)+eq(n\\,30)+eq(n\\,100)+eq(n\\,230)',scale=180:-1,tile=4x1", "-frames:v", "1", process.env.MOTION_DEMO.replace(/\.mp4$/, ".jpg")]);
  }
});

test("S7 · les 7 effets sont bien synthétisés (fichiers non vides)", async (t) => {
  if (!(await ffmpegDispo())) { t.skip("ffmpeg absent"); return; }
  const sfx = await genererSfx(await fs.mkdtemp(path.join(os.tmpdir(), "sfx-")));
  for (const f of Object.values(sfx)) assert.ok((await fs.stat(f)).size > 1000, f);
});
