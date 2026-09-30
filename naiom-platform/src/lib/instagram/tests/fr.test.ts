/** Calibrage français (étape 3) : typographie préservée, lexique français reconnu, scores cohérents. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { humanize, detect, hookscore } from "../tools.ts";
import { espacesDursNonTypographiques, courbesNonTypographiques } from "../fr.ts";

const NBSP = String.fromCodePoint(0xa0);
const FINE = String.fromCodePoint(0x202f);
const APO = String.fromCodePoint(0x2019);

/** Phrase française propre, typographie soignée : espaces insécables, guillemets, apostrophes. */
const PROPRE = `J${APO}ai perdu 1${FINE}500${NBSP}€ sur un seul devis${NBSP}: voilà pourquoi. «${NBSP}Tu signes quand${NBSP}?${NBSP}» m${APO}a demandé Awa. Trois semaines plus tard, rien${NBSP}!`;

test("humanize (fr) ne touche pas une phrase française propre", async () => {
  const r = await humanize(PROPRE, "fr");
  assert.equal(r.text.trimEnd(), PROPRE);
});

test("la typographie française n'est pas comptée comme empreinte machine", () => {
  assert.equal(espacesDursNonTypographiques(PROPRE), 0);
  assert.equal(courbesNonTypographiques(PROPRE), 0);
  // Un espace insécable au milieu d'une phrase reste un indice (collage depuis un outil).
  assert.equal(espacesDursNonTypographiques(`un${NBSP}mot`), 1);
});

test("detect (fr) : FINGERPRINT à 100 sur la phrase propre", async () => {
  const d = await detect(PROPRE, "fr");
  assert.equal(d.checks.FINGERPRINT.score, 100);
});

test("humanize (fr) nettoie les tics français et garde une phrase correcte", async () => {
  const r = await humanize("Dans le monde d'aujourd'hui, il est important de noter que la régularité compte. N'hésitez pas à tester.", "fr");
  assert.doesNotMatch(r.text, /dans le monde d'aujourd'hui|il est important de noter|n'hésitez pas/i);
  const trouves = (r.report.lexical as { find: string }[]).map((x) => x.find);
  assert.ok(trouves.includes("dans le monde d'aujourd'hui"));
  assert.ok(trouves.includes("il est important de noter que"));
});

const HUMAIN_FR = `J${APO}ai posté tous les jours pendant 90 jours. 61 reels ont fait moins de 300 vues. Puis un seul a fait 212 000 vues, et franchement, j${APO}sais toujours pas vraiment pourquoi. Ce que j${APO}ai changé au jour 47${NBSP}? J${APO}écris l${APO}accroche en premier. Je la dis à voix haute. Si elle prend plus de deux secondes, je coupe. C${APO}est tout. C${APO}est ennuyeux, mais ça marche.`;
const MACHINE_FR = "Dans le monde d'aujourd'hui, il est important de noter que la régularité est essentielle. Non seulement elle renforce votre visibilité, mais aussi elle optimise votre engagement. En conclusion, n'hésitez pas à tirer parti de cette stratégie incontournable pour passer au niveau supérieur.";

test("detect (fr) sépare un texte humain d'un texte machine", async () => {
  const h = await detect(HUMAIN_FR, "fr");
  const m = await detect(MACHINE_FR, "fr");
  assert.ok(h.human_score > m.human_score + 20, `humain ${h.human_score} vs machine ${m.human_score}`);
  assert.equal(m.verdict, "FLAGGED");
  assert.equal(h.fiabilite.VOICE, "indicatif");
});

test("hookscore (fr) : une accroche concrète bat une salutation", async () => {
  const r = await hookscore(["Salut les gars, bienvenue sur ma chaîne", `J${APO}ai perdu 18${NBSP}000${NBSP}€ à cause d${APO}une seule clause`], "fr");
  assert.equal(r.classement[0].hook.startsWith("J"), true);
  assert.equal(r.resultats[0].verdict, "WEAK");
  assert.ok(r.resultats[0].flags.some((f) => f.startsWith("Salutation")));
  assert.equal(r.resultats[1].formula_id, 1);
  assert.equal(r.fiabilite, "indicatif");
});
