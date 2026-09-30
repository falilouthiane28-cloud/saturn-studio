/**
 * Outils Instagram au format AI SDK, pour le chat de Fatou (et de Nina ensuite).
 * Tous locaux : scripts du pack, calibrage français, fichiers d'état. Aucun ne touche Instagram.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { jsonSchema, tool, type ToolSet } from "ai";
import { loadSkill, SKILLS, type SkillName } from "./skillLoader.ts";
import { beats, detectAvantApres, hookscore, passerIgHuman } from "./tools.ts";
import { classerAccrochesReel, lintLegende, remplacerChiffresInventes, resumeTri, trierCommentaires } from "./fatou.ts";
import { DOSSIER_ETAT_DEFAUT, EtatFichiers, estUnOui, type FichierEtat } from "./stateStore.ts";
import { creerEnveloppe, type Enveloppe } from "./handoff.ts";
import { LANG } from "./config.ts";

const json = (x: unknown) => JSON.stringify(x, null, 1);
const S = <T>(schema: object) => jsonSchema<T>(schema as Parameters<typeof jsonSchema>[0]);

/** `derniereReponse` : dernier message du propriétaire, seul juge du « oui » avant journalisation. */
export function outilsInstagram(opts: { derniereReponse: string; skills: readonly SkillName[] }): ToolSet {
  const etat = new EtatFichiers();
  return {
    charger_skill: tool({
      description: "Charge le texte intégral d'un SKILL.md du pack Instagram, à suivre tel quel.",
      inputSchema: S<{ nom: SkillName }>({ type: "object", properties: { nom: { type: "string", enum: [...opts.skills] } }, required: ["nom"] }),
      execute: async ({ nom }) => (SKILLS.includes(nom) && opts.skills.includes(nom) ? loadSkill(nom).texte : `Skill non disponible pour cet agent : ${nom}`),
    }),
    hookscore: tool({
      description: "Note et classe des accroches (hookscore.py : 5 contrôles). Meilleur score < 50 : aucune n'est encore l'accroche.",
      inputSchema: S<{ accroches: string[] }>({ type: "object", properties: { accroches: { type: "array", items: { type: "string" }, minItems: 1 } }, required: ["accroches"] }),
      execute: async ({ accroches }) => json(await hookscore(accroches, LANG)),
    }),
    classer_accroches_reel: tool({
      description: "Pipeline Reel : exactement trois accroches de trois formules différentes de hooks.json, notées et classées.",
      inputSchema: S<{ accroches: { formula_id: number; texte: string }[] }>({
        type: "object",
        properties: { accroches: { type: "array", minItems: 3, maxItems: 3, items: { type: "object", properties: { formula_id: { type: "integer", minimum: 1, maximum: 26 }, texte: { type: "string" } }, required: ["formula_id", "texte"] } } },
        required: ["accroches"],
      }),
      execute: async ({ accroches }) => json(await classerAccrochesReel(accroches, LANG)),
    }),
    beats: tool({
      description: "Découpe minutée d'un script (beats.py). Corrige chaque alerte et relance jusqu'à ce que ce soit propre.",
      inputSchema: S<{ script: string; cible_secondes?: number }>({ type: "object", properties: { script: { type: "string" }, cible_secondes: { type: "number" } }, required: ["script"] }),
      execute: async ({ script, cible_secondes }) => json(await beats(script, { target: cible_secondes }, LANG)),
    }),
    caption_lint: tool({
      description: "Contrôle d'une légende (caption.py) + règles Saturn : lien = FAIL, une seule demande, 5 hashtags au plus. Corrige chaque FAIL, tranche chaque WARN à voix haute.",
      inputSchema: S<{ legende: string; mots_cles: string[] }>({ type: "object", properties: { legende: { type: "string" }, mots_cles: { type: "array", items: { type: "string" }, maxItems: 3 } }, required: ["legende", "mots_cles"] }),
      execute: async ({ legende, mots_cles }) => json(await lintLegende(legende, mots_cles, LANG)),
    }),
    ig_human: tool({
      description: "Passage obligatoire avant de montrer un texte : nettoyage (humanize.py) puis panneau de 5 contrôles. Montre le texte ET le score ; ce sont des heuristiques locales, jamais « indétectable ».",
      inputSchema: S<{ texte: string }>({ type: "object", properties: { texte: { type: "string" } }, required: ["texte"] }),
      execute: async ({ texte }) => json(await passerIgHuman(texte, LANG)),
    }),
    detect_avant_apres: tool({
      description: "Panneau de détection avant / après une réécriture (detect.py).",
      inputSchema: S<{ avant: string; apres: string }>({ type: "object", properties: { avant: { type: "string" }, apres: { type: "string" } }, required: ["avant", "apres"] }),
      execute: async ({ avant, apres }) => json(await detectAvantApres(avant, apres, LANG)),
    }),
    verifier_chiffres: tool({
      description: "Remplace par {{your number}} tout chiffre absent des sources du propriétaire (idée, transcription, stats collées) et liste ce qui est à remplir.",
      inputSchema: S<{ texte: string; sources: string[] }>({ type: "object", properties: { texte: { type: "string" }, sources: { type: "array", items: { type: "string" } } }, required: ["texte", "sources"] }),
      execute: async ({ texte, sources }) => json(remplacerChiffresInventes(texte, sources)),
    }),
    trier_commentaires: tool({
      description: "Tri des commentaires collés : KEYWORD, LEAD, SUBSTANCE, QUESTION, SUPPORT, NOISE. Annonce les comptes avant toute réponse ; NOISE ne reçoit rien.",
      inputSchema: S<{ commentaires: { auteur: string; texte: string }[]; mot_cle?: string }>({
        type: "object",
        properties: { commentaires: { type: "array", items: { type: "object", properties: { auteur: { type: "string" }, texte: { type: "string" } }, required: ["auteur", "texte"] } }, mot_cle: { type: "string" } },
        required: ["commentaires"],
      }),
      execute: async ({ commentaires, mot_cle }) => {
        const t = trierCommentaires(commentaires, { motCle: mot_cle });
        return json({ resume: resumeTri(t), comptes: t.comptes, aRepondre: t.aRepondre, questionsPourReel: t.questionsPourReel });
      },
    }),
    lire_etat: tool({
      description: "Lit un fichier d'état : voice.md, swipe.md, log.md ou plan.md.",
      inputSchema: S<{ fichier: FichierEtat }>({ type: "object", properties: { fichier: { type: "string", enum: ["voice.md", "swipe.md", "log.md", "plan.md"] } }, required: ["fichier"] }),
      execute: async ({ fichier }) => (await etat.lire(fichier)) ?? `${fichier} n'existe pas encore.`,
    }),
    ecrire_etat: tool({
      description: "Écrit voice.md, swipe.md ou plan.md (log.md : utiliser journaliser).",
      inputSchema: S<{ fichier: "voice.md" | "swipe.md" | "plan.md"; contenu: string }>({ type: "object", properties: { fichier: { type: "string", enum: ["voice.md", "swipe.md", "plan.md"] }, contenu: { type: "string" } }, required: ["fichier", "contenu"] }),
      execute: async ({ fichier, contenu }) => { await etat.ecrire(fichier, contenu); return `${fichier} enregistré.`; },
    }),
    journaliser: tool({
      description: "Ajoute une ligne à log.md (date, formule, première ligne). Refusé tant que le propriétaire n'a pas répondu « oui » dans son dernier message.",
      inputSchema: S<{ ligne: string }>({ type: "object", properties: { ligne: { type: "string" } }, required: ["ligne"] }),
      execute: async ({ ligne }) => {
        if (!estUnOui(opts.derniereReponse)) return "REFUSÉ : rien n'est journalisé avant le « oui » du propriétaire. Demande-lui de valider.";
        await etat.ajouterAuJournal(`${new Date().toISOString().slice(0, 10)} ${ligne}`);
        return "Ajouté à log.md.";
      },
    }),
    passer_relais: tool({
      description: "Enveloppe de relais entre Fatou et Nina (formule, angle du propriétaire, preuve, compte source).",
      inputSchema: S<Omit<Enveloppe, "created_at">>({
        type: "object",
        properties: {
          from: { type: "string", enum: ["fatou", "nina"] }, to: { type: "string", enum: ["fatou", "nina"] }, capability: { type: "string" },
          formula_id: { type: ["integer", "null"] }, angle: { type: "string" }, evidence: { type: "string" }, source_account: { type: ["string", "null"] },
        },
        required: ["from", "to", "capability", "formula_id", "angle", "evidence", "source_account"],
      }),
      execute: async (e) => {
        const env = creerEnveloppe(e);
        await fs.mkdir(DOSSIER_ETAT_DEFAUT, { recursive: true });
        await fs.appendFile(path.join(DOSSIER_ETAT_DEFAUT, "relais.jsonl"), JSON.stringify(env) + "\n", "utf8");
        return json(env);
      },
    }),
  };
}
