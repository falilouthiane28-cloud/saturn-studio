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
import { DUREE_MAX, animerImage, estRequestId, lancerImageCle, lancerVideo, statutVideo, type VideoDemande } from "../integrations/higgsfieldVideo.ts";
import { assemblerMotion } from "../integrations/montageMotion.ts";
import { ajouterStyle, decouperScenes, lireStyles, promptAnimation, promptImage, promptRespecteStyle, verifierNarration, type Duree, type FormatVideo, type StyleMotion } from "./motion.ts";

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
    generer_video: tool({
      description: `Génère un plan vidéo motion design avec Higgsfield (Seedance 2.5, texte → vidéo, 4 à ${DUREE_MAX} s, 9:16 par défaut, sans texte à l'écran : le texte s'ajoute au montage). Dépense les crédits Higgsfield du propriétaire : montre-lui d'abord le prompt, la durée et le format, et n'appelle cet outil qu'après son « oui ». Renvoie un request_id à suivre avec statut_video.`,
      inputSchema: S<VideoDemande>({
        type: "object",
        properties: {
          prompt: { type: "string" },
          duree: { type: "integer", minimum: 4, maximum: DUREE_MAX },
          format: { type: "string", enum: ["9:16", "1:1", "3:4", "4:3", "16:9", "21:9"] },
          resolution: { type: "string", enum: ["480p", "720p", "1080p"] },
          audio: { type: "boolean" },
        },
        required: ["prompt"],
      }),
      execute: async (d) => {
        if (!estUnOui(opts.derniereReponse)) return "REFUSÉ : une vidéo dépense des crédits Higgsfield. Montre le prompt, la durée et le format au propriétaire et attends son « oui ».";
        try { return json({ request_id: await lancerVideo(d), suite: "Appelle statut_video avec ce request_id dans une minute environ." }); }
        catch (e) { return `ÉCHEC : ${(e as Error).message}`; }
      },
    }),
    statut_video: tool({
      description: "Suit un job vidéo Higgsfield lancé par generer_video : queued, in_progress, completed (avec l'URL de la vidéo, valable au moins 7 jours : à télécharger) ou failed.",
      inputSchema: S<{ request_id: string }>({ type: "object", properties: { request_id: { type: "string" } }, required: ["request_id"] }),
      execute: async ({ request_id }) => {
        try { return json(await statutVideo(request_id)); }
        catch (e) { return `ÉCHEC : ${(e as Error).message}`; }
      },
    }),
    plan_video_motion: tool({
      description: "Motion design : découpe la vidéo en scènes (15 s → 4, 20-25 s → 6, 30 s → 7), rend les timecodes, le fond de chaque scène, la cible de mots de narration et les prompts d'images (sans texte) et d'animation au style actif. Un texte à l'écran par scène, 6 mots maximum, un seul mot accentué entre *astérisques*. Styles : clean-explainer, lancement-saas, produit-3d, degrade-doux. Format 9:16 ou 16:9.",
      inputSchema: S<{ duree: Duree; textes_ecran: string[]; style?: string; format?: FormatVideo }>({
        type: "object",
        properties: { duree: { type: "integer", enum: [15, 20, 25, 30] }, textes_ecran: { type: "array", items: { type: "string" } }, style: { type: "string" }, format: { type: "string", enum: ["9:16", "16:9"] } },
        required: ["duree", "textes_ecran"],
      }),
      execute: async ({ duree, textes_ecran, style, format }) => {
        try {
          const styles = await lireStyles(DOSSIER_ETAT_DEFAUT);
          const actif = styles[style ?? "clean-explainer"];
          if (!actif) return `Style inconnu : ${style}. Disponibles : ${Object.keys(styles).join(", ")}.`;
          const scenes = decouperScenes(duree);
          if (textes_ecran.length !== scenes.length) return `Il faut ${scenes.length} textes à l'écran (un par scène) pour ${duree} s, reçu ${textes_ecran.length}.`;
          return json({
            duree, style: actif.name, mots_narration: Math.round(duree * 2.5),
            scenes: scenes.map((s, i) => ({ ...s, texte_ecran: textes_ecran[i], prompt_image: promptImage(s, textes_ecran[i], actif, format ?? "9:16"), prompt_animation: promptAnimation(s) })),
            cout: `${scenes.length} images clés + ${scenes.length} animations à payer sur l'API Higgsfield`,
          });
        } catch (e) { return `ERREUR : ${(e as Error).message}`; }
      },
    }),
    verifier_narration: tool({
      description: "Contrôle la narration d'une vidéo : environ 2,5 mots par seconde (±20 %) et passage ig-human (score ≥ 70 exigé). Si ok est false, réécris avant de montrer.",
      inputSchema: S<{ texte: string; duree: number }>({ type: "object", properties: { texte: { type: "string" }, duree: { type: "integer" } }, required: ["texte", "duree"] }),
      execute: async ({ texte, duree }) => json(await verifierNarration(texte, duree, LANG)),
    }),
    generer_image_cle: tool({
      description: "Génère l'image clé d'une scène (9:16 par défaut, ou 16:9) avec Higgsfield, à partir du prompt rendu par plan_video_motion. Dépense des crédits : seulement après le « oui » du propriétaire. Renvoie un request_id (suivi avec statut_video, champ imageUrl).",
      inputSchema: S<{ prompt: string; format?: FormatVideo }>({ type: "object", properties: { prompt: { type: "string" }, format: { type: "string", enum: ["9:16", "16:9"] } }, required: ["prompt"] }),
      execute: async ({ prompt, format }) => {
        if (!promptRespecteStyle(prompt)) return "REFUSÉ : le prompt doit reprendre le style (un fond, « motion design », « no text »). Utilise le prompt rendu par plan_video_motion.";
        if (!estUnOui(opts.derniereReponse)) return "REFUSÉ : une image dépense des crédits Higgsfield. Montre le plan au propriétaire et attends son « oui ».";
        try { return json({ request_id: await lancerImageCle(prompt, format ?? "9:16") }); }
        catch (e) { return `ÉCHEC : ${(e as Error).message}`; }
      },
    }),
    animer_scene: tool({
      description: "Anime une image clé générée par generer_image_cle (request_id terminé), avec le prompt d'animation de plan_video_motion, 2 à 15 s. Jamais une image ou une vidéo externe. Dépense des crédits : seulement après le « oui ».",
      inputSchema: S<{ image_request_id: string; prompt: string; duree: number }>({
        type: "object",
        properties: { image_request_id: { type: "string" }, prompt: { type: "string" }, duree: { type: "integer", minimum: 2, maximum: 15 } },
        required: ["image_request_id", "prompt", "duree"],
      }),
      execute: async ({ image_request_id, prompt, duree }) => {
        if (!estRequestId(image_request_id)) return "REFUSÉ : seulement une image générée par generer_image_cle (son request_id), jamais une URL ou un fichier externe.";
        if (!estUnOui(opts.derniereReponse)) return "REFUSÉ : une animation dépense des crédits Higgsfield. Attends le « oui » du propriétaire.";
        try {
          const img = await statutVideo(image_request_id);
          if (img.status !== "completed" || !img.imageUrl) return `L'image ${image_request_id} n'est pas prête (${img.status}). Réessaie avec statut_video.`;
          return json({ request_id: await animerImage(img.imageUrl, prompt, duree) });
        } catch (e) { return `ÉCHEC : ${(e as Error).message}`; }
      },
    }),
    assembler_video: tool({
      description: "Monte la vidéo finale sur le serveur : colle dans l'ordre les clips des scènes (request_id rendus par animer_scene, tous « completed ») en un MP4 vertical 720×1280, et renvoie son lien public. Ne dépense aucun crédit.",
      inputSchema: S<{ request_ids: string[] }>({ type: "object", properties: { request_ids: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 12 } }, required: ["request_ids"] }),
      execute: async ({ request_ids }) => {
        try { const r = await assemblerMotion(request_ids); return json({ url: r.url, clips: r.clips }); }
        catch (e) { return `ÉCHEC : ${(e as Error).message}`; }
      },
    }),
    ajouter_style_motion: tool({
      description: "Ajoute un style de motion design demandé par le propriétaire dans motion-styles.json (identifiant en kebab-case).",
      inputSchema: S<{ id: string; style: StyleMotion }>({
        type: "object",
        properties: {
          id: { type: "string" },
          style: {
            type: "object",
            properties: { name: { type: "string" }, backgrounds: { type: "array", items: { type: "string" } }, accents: { type: "array", items: { type: "string" } }, typography: { type: "string" }, elements: { type: "string" }, transitions: { type: "string" }, pacing: { type: "string" }, tension_frame: { type: "string" } },
            required: ["name", "backgrounds", "accents", "typography", "elements", "transitions", "pacing", "tension_frame"],
          },
        },
        required: ["id", "style"],
      }),
      execute: async ({ id, style }) => {
        try { await ajouterStyle(DOSSIER_ETAT_DEFAUT, id, style); return `Style ${id} ajouté à motion-styles.json.`; }
        catch (e) { return `ERREUR : ${(e as Error).message}`; }
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
