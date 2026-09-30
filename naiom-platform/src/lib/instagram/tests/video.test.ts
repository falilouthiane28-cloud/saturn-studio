/** Vidéo Higgsfield dans le chat de Fatou : contrat de requête et garde-fous, sans réseau ni crédit. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { corpsVideo, videoUrlOf, DUREE_MAX } from "../../integrations/higgsfieldVideo.ts";
import { outilsInstagram } from "../aiTools.ts";
import { FATOU_SKILLS } from "../fatou.ts";
import { OUTILS_FATOU } from "../outils.ts";
import { violationsBrouillon } from "../guard.ts";

test("V1 · corps conforme à la doc Seedance 2.5 : 9:16, 5 s, 720p, mp4 par défaut", () => {
  assert.deepEqual(corpsVideo({ prompt: " robot blanc " }), {
    prompt: "robot blanc", duration: 5, aspect_ratio: "9:16", resolution: "720p", output_format: "mp4", generate_audio: false,
  });
});

test("V2 · bornes : prompt vide, durée hors 4-15 s, format inconnu → refusés avant tout appel", () => {
  assert.throws(() => corpsVideo({ prompt: "  " }), /vide/);
  assert.throws(() => corpsVideo({ prompt: "x", duree: 3 }), /Durée/);
  assert.throws(() => corpsVideo({ prompt: "x", duree: DUREE_MAX + 1 }), /Durée/);
  assert.throws(() => corpsVideo({ prompt: "x", format: "4:5" as never }), /Format/);
});

test("V3 · l'URL de la vidéo est lue dans le champ video (objet ou texte), sinon output", () => {
  assert.equal(videoUrlOf({ video: { url: "https://cdn/x.mp4" } }), "https://cdn/x.mp4");
  assert.equal(videoUrlOf({ video: "https://cdn/y.mp4" }), "https://cdn/y.mp4");
  assert.equal(videoUrlOf({ output: ["https://cdn/z.mp4"] }), "https://cdn/z.mp4");
  assert.equal(videoUrlOf({ status: "queued" }), null);
});

test("V4 · generer_video refuse tant que le dernier message du propriétaire n'est pas « oui »", async () => {
  const t = outilsInstagram({ derniereReponse: "fais une vidéo du robot", skills: FATOU_SKILLS });
  const r = await t.generer_video.execute!({ prompt: "robot" }, { toolCallId: "1", messages: [] });
  assert.match(String(r), /REFUSÉ/);
});

test("V5 · avec « oui » mais sans clé Higgsfield : échec clair, aucun appel réseau", async () => {
  const avant = process.env.HIGGSFIELD_API_KEY;
  process.env.HIGGSFIELD_API_KEY = "";
  try {
    const t = outilsInstagram({ derniereReponse: "oui", skills: FATOU_SKILLS });
    const r = await t.generer_video.execute!({ prompt: "robot" }, { toolCallId: "1", messages: [] });
    assert.match(String(r), /ÉCHEC : Higgsfield non connecté/);
  } finally { process.env.HIGGSFIELD_API_KEY = avant; }
});

test("V6 · les outils vidéo passent la garde brouillon-seulement (ils ne publient rien)", () => {
  assert.ok(OUTILS_FATOU.some((o) => o.name === "generer_video"));
  assert.deepEqual(violationsBrouillon(OUTILS_FATOU), []);
});
