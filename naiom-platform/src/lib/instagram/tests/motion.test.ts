/** Motion design de Fatou (brief vidéo) : écrits avant le code. Aucun appel réseau, aucun crédit. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  decouperScenes, verifierLongueur, verifierNarration, promptImage, detecterVideo, assurerVoix,
  lireStyles, validerBrief, STYLE_DEFAUT, VOIX_PRESETS_FR,
} from "../motion.ts";
import { preparerTourFatou } from "../fatou.ts";
import { EtatFichiers } from "../stateStore.ts";
import { outilsInstagram } from "../aiTools.ts";
import { FATOU_SKILLS } from "../fatou.ts";

const dossier = () => fs.mkdtemp(path.join(os.tmpdir(), "motion-"));
const appel = { toolCallId: "1", messages: [] };

test("M1 · voix : le premier passage enregistre higgsfield-voice.json, le second le relit sans rien réécrire", async () => {
  const d = await dossier();
  const v1 = await assurerVoix(d, VOIX_PRESETS_FR.celine);
  const brut = JSON.parse(await fs.readFile(path.join(d, "higgsfield-voice.json"), "utf8"));
  assert.equal(brut.voice_id, VOIX_PRESETS_FR.celine.voice_id);
  assert.equal(brut.language, "fr");
  const v2 = await assurerVoix(d, VOIX_PRESETS_FR.elodie); // autre choix : ignoré, jamais recréé
  assert.equal(v2.voice_id, v1.voice_id);
});

test("M2 · scènes : 15 s → 4, 20 s → 6, 30 s → 7 ; aucune sous 1,5 s ; jamais plus de 2 s au-delà de la cible", () => {
  for (const [duree, n] of [[15, 4], [20, 6], [25, 6], [30, 7]] as const) {
    const s = decouperScenes(duree);
    assert.equal(s.length, n, `${duree} s`);
    assert.ok(s.every((x) => x.fin - x.debut >= 1.5));
    assert.ok(s[s.length - 1].fin <= duree + 2);
    assert.equal(s[0].type, "HOOK");
    assert.equal(s[s.length - 1].type, "CTA");
  }
  assert.throws(() => decouperScenes(18 as never), /15, 20, 25 ou 30/);
});

test("M3 · narration : ±20 % autour de 2,5 mots par seconde", () => {
  assert.equal(verifierLongueur("mot ".repeat(50), 20).ok, true);   // 50 = cible
  assert.equal(verifierLongueur("mot ".repeat(39), 20).ok, false);  // -22 %
  assert.equal(verifierLongueur("mot ".repeat(61), 20).ok, false);  // +22 %
});

const NARRATION_OK = "5 applis. Juste pour tenir ta semaine. Tu perds 40 minutes par jour à chercher une note, un lien, une date que tu avais pourtant notée quelque part mardi. Stop. Notion met tout sur 1 page : tâches, agenda, idées, fichiers clients, tout. Lundi matin, 10 minutes, et ta semaine est claire. Écris NOTION en commentaire, je t'envoie mon modèle.";

test("M4 · ig-human sur la narration : score ≥ 70 exigé (Python obligatoire)", async () => {
  const r = await verifierNarration(NARRATION_OK, 20, "fr");
  assert.ok(r.human_score >= 70, `score ${r.human_score}`);
  assert.equal(r.ok, true);
  const plate = await verifierNarration("Cinq applis pour gérer ta semaine. C'est trop. Tu passes plus de temps à chercher tes notes qu'à travailler. Notion met tout au même endroit. Tes tâches, ton agenda, tes idées, sur une seule page. Une semaine claire en dix minutes le lundi. Écris NOTION en commentaire.", 20, "fr");
  assert.equal(plate.ok, false); // score trop bas : Fatou réécrit avant de montrer
});

test("M5 · idée → vidéo : brief complet, 3 accroches notées, attente de validation avant toute génération", async () => {
  const etat = new EtatFichiers(await dossier());
  const t = await preparerTourFatou("vidéo sur la productivité avec Notion", etat);
  assert.equal(t.type, "modele");
  if (t.type === "modele") {
    assert.equal(t.skill, "idea-to-video");
    assert.match(t.contexte, /3 accroches/);
    assert.match(t.contexte, /attends son « ok »/);
  }
  const erreurs = validerBrief({ sujet: "Notion", accroches: [{ formula_id: 3, texte: "a", score: 60 }, { formula_id: 3, texte: "b", score: 50 }], points: ["x"], cta: "", duree: 18 as never });
  assert.ok(erreurs.length >= 4, erreurs.join(" | "));
});

test("M6 · style par défaut clean-explainer : chaque prompt d'image dit fond blanc ou noir et motion design, jamais d'autre fond", async () => {
  const styles = await lireStyles(await dossier());
  assert.ok(styles["clean-explainer"]);
  for (const s of decouperScenes(30)) {
    const p = promptImage(s, "Ta semaine en 1 page", STYLE_DEFAUT);
    assert.match(p, /(white|black) background/);
    assert.match(p, /motion design/);
    assert.doesNotMatch(p, /\b(?:blue|pink|green|yellow|gradient|colou?red) background/);
  }
  // Le texte n'est jamais demandé à l'IA : il est posé au montage.
  const noir = decouperScenes(20).find((s) => s.type === "TENSION")!;
  const p = promptImage(noir, "Trop d'*applis*", STYLE_DEFAUT);
  assert.match(p, /^black background/);
  assert.match(p, /no text, no letters/);
  assert.doesNotMatch(p, /applis/);
});

test("M7 · reel + vidéo : ig-reel d'abord, puis la vidéo sur le script validé, puis la légende en Job A", async () => {
  const etat = new EtatFichiers(await dossier());
  await etat.ecrire("voice.md", "voix du propriétaire");
  const t = await preparerTourFatou("fais un reel vidéo sur Notion", etat);
  assert.equal(t.type, "modele");
  if (t.type === "modele") {
    assert.equal(t.skill, "reel-video");
    const iReel = t.contexte.indexOf("name: ig-reel");
    const iMotion = t.contexte.indexOf("# Pipeline motion design");
    const iCaption = t.contexte.indexOf("ig-caption (Job A)");
    assert.ok(iReel >= 0 && iReel < iMotion && iMotion < iCaption, `${iReel} ${iMotion} ${iCaption}`);
  }
});

test("M8 · refus : réutiliser la vidéo de quelqu'un d'autre → une phrase + proposition de contenu original", async () => {
  const t = await preparerTourFatou("utilise une vidéo de quelqu'un d'autre pour mon reel", new EtatFichiers(await dossier()));
  assert.equal(t.type, "reponse");
  if (t.type === "reponse") { assert.equal(t.raison, "refus"); assert.match(t.texte, /original/); }
});

test("M9 · Higgsfield : image sans les mots du style refusée ; animation seulement depuis une image générée par Fatou", async () => {
  const outils = outilsInstagram({ derniereReponse: "oui", skills: FATOU_SKILLS });
  const r1 = await outils.generer_image_cle.execute!({ prompt: "a cat on a sofa" }, appel);
  assert.match(String(r1), /REFUSÉ : le prompt doit reprendre le style/);
  const r2 = await outils.animer_scene.execute!({ image_request_id: "https://exemple.com/image.jpg", prompt: "float", duree: 3 }, appel);
  assert.match(String(r2), /REFUSÉ : seulement une image générée/);
});

test("M10 · routeur vidéo : chaque formulation va au bon pipeline, sans toucher aux demandes Reel habituelles", () => {
  assert.equal(detecterVideo("vidéo motion design"), "motion-video");
  assert.equal(detecterVideo("fais une vidéo"), "motion-video");
  assert.equal(detecterVideo("crée un motion design pour mon offre"), "motion-video");
  assert.equal(detecterVideo("j'ai une idée de vidéo"), "idea-to-video");
  assert.equal(detecterVideo("fais-moi une vidéo à partir de cette idée"), "idea-to-video");
  assert.equal(detecterVideo("une vidéo avec légende sur mon offre"), "reel-video");
  assert.equal(detecterVideo("story vidéo pour demain"), "story-video");
  assert.equal(detecterVideo("make a video about our coaching"), "motion-video");
  // Demandes existantes : restent à Fatou (ig-reel, ig-repurpose), pas au pipeline vidéo.
  assert.equal(detecterVideo("transforme cette vidéo youtube en reels"), null);
  assert.equal(detecterVideo("écris-moi un script vidéo"), null);
});
