/**
 * Plan d'une vidéo motion design à partir d'une idée et d'un template : Claude écrit le brief
 * (3 accroches de 3 formules, points clés, CTA, texte à l'écran et narration par scène), puis
 * tout ce qui est vérifiable l'est en code : notes hookscore, 6 mots maximum à l'écran,
 * chiffres absents de l'idée masqués, longueur et score ig-human de la narration, prompts au style.
 */
import fs from "node:fs";
import path from "node:path";
import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { SKILLS_DIR } from "./python.ts";
import { hookscore } from "./tools.ts";
import { remplacerChiffresInventes } from "./fatou.ts";
import { promptAnimation, promptImage, verifierNarration, type Scene, type StyleMotion } from "./motion.ts";
import { scenesDuTemplate, type TemplateVideo } from "./motionTemplates.ts";
import { LANG } from "./config.ts";

export interface ScenePlan extends Scene { texte_ecran: string; narration: string; prompt_image: string; prompt_animation: string }
export interface MotionPlan {
  idee: string;
  template: { id: string; name: string };
  style: string;
  duree: number;
  sujet: string;
  public: string;
  accroches: { formula_id: number; texte: string; score: number }[]; // triées, la meilleure ouvre la vidéo
  points: string[];
  cta: string;
  scenes: ScenePlan[];
  narration: { texte: string; human_score: number; verdict: string; ok: boolean; mots: number; cible: number };
  chiffres_a_remplir: string[];
}

interface Brouillon {
  sujet: string; public: string; cta: string; points: string[];
  accroches: { formula_id: number; texte: string }[];
  scenes: { texte_ecran: string; narration: string }[];
}

function formules(): string {
  const d = JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, "ig-reel", "hooks.json"), "utf8")) as { hooks: { id: number; name: string; example?: string }[] };
  return d.hooks.map((h) => `${h.id}. ${h.name}${h.example ? ` (ex. « ${h.example} »)` : ""}`).join("\n");
}

const sixMots = (t: string) => t.split(/\s+/).filter(Boolean).slice(0, 6).join(" ");

/** Parse le JSON rendu par le modèle (tolère un bloc markdown autour). */
export function lireBrouillon(texte: string, nbScenes: number): Brouillon {
  const j = JSON.parse(texte.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")) as Brouillon;
  if (!Array.isArray(j.accroches) || j.accroches.length !== 3) throw new Error("Le plan doit contenir 3 accroches.");
  if (new Set(j.accroches.map((a) => a.formula_id)).size !== 3) throw new Error("Les 3 accroches doivent venir de 3 formules différentes.");
  if (!Array.isArray(j.scenes) || j.scenes.length !== nbScenes) throw new Error(`Le plan doit contenir ${nbScenes} scènes.`);
  if (!Array.isArray(j.points) || j.points.length < 3 || j.points.length > 5) throw new Error("3 à 5 points clés.");
  return j;
}

export async function preparerPlan(idee: string, template: TemplateVideo, style: StyleMotion, styleId: string): Promise<MotionPlan> {
  const idea = idee.trim();
  if (!idea) throw new Error("Décris ton idée de vidéo.");
  if (idea.length > 2000) throw new Error("Idée trop longue (2000 caractères maximum).");
  const scenes = scenesDuTemplate(template);
  const mots = Math.round(template.duree * 2.5);

  const system = `Tu es Fatou, directrice de création de Saturn Studio (studio design et tech à Dakar). Tu écris des vidéos motion design courtes au style « clean explainer » : fonds blanc et quasi noir, icônes 3D, texte gras centré.
Règles : français naturel, tutoiement, aucun jargon creux. Aucun chiffre inventé : n'utilise que les chiffres présents dans l'idée, sinon écris {{your number}}. Texte à l'écran : 6 mots maximum par scène. Narration : environ ${mots} mots au total, une ou deux phrases par scène, longueurs de phrases variées, chiffres écrits en chiffres.
Tu réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.`;
  const prompt = `Idée : ${idea}
Template : ${template.name} (${template.duree} s)
Scènes, dans l'ordre : ${scenes.map((s) => `${s.n}. ${s.type} (${s.fin - s.debut} s, fond ${s.fond === "white" ? "blanc" : "noir"})`).join(" ; ")}
Formules d'accroche disponibles (hooks.json) :
${formules()}

Rends ce JSON :
{"sujet":"…","public":"…","cta":"…","points":["3 à 5 points concrets"],
 "accroches":[{"formula_id":N,"texte":"…"},{"formula_id":N,"texte":"…"},{"formula_id":N,"texte":"…"}],
 "scenes":[${scenes.map(() => `{"texte_ecran":"≤ 6 mots","narration":"…"}`).join(",")}]}
Les 3 accroches viennent de 3 formules différentes. Le texte à l'écran de la scène 1 reprend la meilleure accroche en 6 mots maximum. La dernière scène porte le CTA.`;

  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { text } = await generateText({ model: anthropic(process.env.MOTION_MODEL ?? "claude-opus-5-5"), maxOutputTokens: 2000, system, prompt });
  const b = lireBrouillon(text, scenes.length);

  const notes = await hookscore(b.accroches.map((a) => a.texte), LANG);
  const accroches = b.accroches
    .map((a, i) => ({ formula_id: a.formula_id, texte: a.texte, score: notes.resultats[i]?.score ?? 0 }))
    .sort((x, y) => y.score - x.score);

  const sources = [idea];
  const signales: string[] = [];
  const propre = (t: string) => { const r = remplacerChiffresInventes(t, sources); signales.push(...r.signales); return r.texte; };

  const scenesPlan: ScenePlan[] = scenes.map((s, i) => {
    const texte_ecran = sixMots(propre(b.scenes[i].texte_ecran ?? ""));
    return { ...s, texte_ecran, narration: propre(b.scenes[i].narration ?? ""), prompt_image: promptImage(s, texte_ecran || template.name, style), prompt_animation: promptAnimation(s) };
  });
  const narrationTexte = scenesPlan.map((s) => s.narration).join(" ");
  const n = await verifierNarration(narrationTexte, template.duree, LANG);

  return {
    idee: idea, template: { id: template.id, name: template.name }, style: styleId, duree: template.duree,
    sujet: b.sujet, public: b.public, accroches, points: b.points, cta: propre(b.cta), scenes: scenesPlan,
    narration: { texte: narrationTexte, human_score: n.human_score, verdict: n.verdict, ok: n.ok, mots: n.longueur.mots, cible: n.longueur.cible },
    chiffres_a_remplir: [...new Set(signales)],
  };
}

/** Claude propose un template à partir d'une description ; la validation se fait à l'enregistrement. */
export async function proposerTemplate(description: string, stylesDispo: string[]): Promise<TemplateVideo> {
  const d = description.trim();
  if (!d || d.length > 1000) throw new Error("Décris le template en 1 à 1000 caractères.");
  const system = `Tu conçois des templates de vidéos motion design courtes. Types de scène : HOOK (accroche, fond blanc), CONTEXT (contexte, fond blanc), TENSION (le problème, fond noir), SOLUTION (fond blanc, maquette de téléphone), PROOF (le résultat, fond blanc), CTA (appel à l'action, fond noir).
Contraintes : durée 15, 20, 25 ou 30 s ; 4 à 7 scènes ; la première est HOOK, la dernière CTA ; chaque scène dure de 1,5 à 10 s ; la somme des scènes égale la durée. Réponds UNIQUEMENT avec un objet JSON valide.`;
  const prompt = `Description : ${d}
Styles disponibles : ${stylesDispo.join(", ")}
Rends : {"id":"kebab-case","name":"≤ 40 caractères","description":"une phrase","duree":20,"style":"clean-explainer","scenes":[{"type":"HOOK","secondes":2}]}`;
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const { text } = await generateText({ model: anthropic(process.env.MOTION_MODEL ?? "claude-opus-5-5"), maxOutputTokens: 800, system, prompt });
  return JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")) as TemplateVideo;
}
