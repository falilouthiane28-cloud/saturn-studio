/** Montage motion design : vrai ffmpeg sur des clips de test, garde-fous de l'outil, voix par défaut. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { argsConcat, concatLocal } from "../../integrations/montageMotion.ts";
import { outilsInstagram } from "../aiTools.ts";
import { FATOU_SKILLS, preparerTourFatou } from "../fatou.ts";
import { EtatFichiers } from "../stateStore.ts";
import { VOIX_PRESETS_FR } from "../motion.ts";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";

async function ffmpegDispo() { try { await run(FFMPEG, ["-version"]); return true; } catch { return false; } }

test("MO1 · deux clips de formats différents (9:16 et 16:9) → un MP4 720×1280 de la durée cumulée", async (t) => {
  if (!(await ffmpegDispo())) { t.skip("ffmpeg absent sur cette machine"); return; }
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "montage-"));
  const a = path.join(d, "a.mp4"), b = path.join(d, "b.mp4"), out = path.join(d, "final.mp4");
  await run(FFMPEG, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=720x1280:rate=24:duration=1.5", "-pix_fmt", "yuv420p", a]);
  await run(FFMPEG, ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=1280x720:rate=30:duration=2", "-pix_fmt", "yuv420p", b]);
  await concatLocal([a, b], out);
  const { stdout } = await run(FFMPEG.replace(/ffmpeg(\.exe)?$/i, "ffprobe$1"), ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", out]);
  const info = JSON.parse(stdout);
  console.log("MO1 sortie :", JSON.stringify({ width: info.streams[0].width, height: info.streams[0].height, duration: info.format.duration }));
  assert.equal(info.streams[0].width, 720);
  assert.equal(info.streams[0].height, 1280);
  assert.ok(Math.abs(Number(info.format.duration) - 3.5) < 0.2);
});

test("MO2 · montage : 2 à 12 clips, jamais d'appel sans filtre", () => {
  assert.throws(() => argsConcat(["a.mp4"], "o.mp4"), /de 2 à 12/);
  const args = argsConcat(["a.mp4", "b.mp4"], "o.mp4");
  assert.ok(args.includes("-filter_complex"));
  assert.equal(args[args.length - 1], "o.mp4");
});

test("MO3 · assembler_video refuse une URL ou un fichier externe (seulement des request_id)", async () => {
  const o = outilsInstagram({ derniereReponse: "", skills: FATOU_SKILLS });
  const r = await o.assembler_video.execute!({ request_ids: ["https://x.com/a.mp4", "abcdef-123"] }, { toolCallId: "1", messages: [] });
  assert.match(String(r), /ÉCHEC : Montage : uniquement des request_id/);
});

test("MO4 · première demande vidéo : la voix Celine est enregistrée dans higgsfield-voice.json", async () => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "voix-"));
  await preparerTourFatou("fais une vidéo sur notre offre", new EtatFichiers(d));
  const v = JSON.parse(await fs.readFile(path.join(d, "higgsfield-voice.json"), "utf8"));
  assert.equal(v.voice_id, VOIX_PRESETS_FR.celine.voice_id);
  const styles = JSON.parse(await fs.readFile(path.join(d, "motion-styles.json"), "utf8"));
  assert.ok(styles["clean-explainer"]);
});
