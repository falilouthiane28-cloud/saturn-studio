/**
 * Fatou, agente Instagram (contenu et engagement) : garde-fous déterministes autour des skills.
 * Avant chaque tour, preparerTourFatou() décide : réponse immédiate (refus, question, voix
 * manquante, DM sans déclencheur) ou passage au modèle avec le SKILL.md choisi + les fichiers
 * d'état. Les règles vérifiables (chiffres inventés, trois formules, lien en légende, tri des
 * commentaires) sont appliquées ici, en code, et testées.
 */
import { refusSiInterdit } from "./guard.ts";
import { router } from "./router.ts";
import { loadSkill, type SkillName } from "./skillLoader.ts";
import type { AdaptateurEtat } from "./stateStore.ts";
import { captionLint, hookscore, type CaptionLint, type HookClassement } from "./tools.ts";
import { LANG, type Langue } from "./config.ts";

export const FATOU_SKILLS: readonly SkillName[] = ["ig-reel", "ig-caption", "ig-carousel", "ig-story", "ig-repurpose", "ig-comment", "ig-reply", "ig-dm", "ig-human"];

/** Skills qui écrivent dans la voix du propriétaire : voice.md obligatoire (ig-reel l'exige). */
const BESOIN_VOIX = new Set<SkillName>(["ig-reel"]);

export type Tour =
  | { type: "reponse"; texte: string; raison: "refus" | "question" | "voix" | "dm-sans-declencheur" | "dm-a-froid" }
  | { type: "modele"; skill: SkillName; contexte: string }
  | { type: "libre" }; // pas une demande Instagram : Fatou reprend son travail habituel

/* ---------------- DM : déclencheur obligatoire ---------------- */
const DECLENCHEURS: [RegExp, "main-levee" | "approche-chaude" | "collab"][] = [
  [/\b(?:a|m'a|ont)\s+(?:commenté|écrit|demandé|répondu|réagi|posé une question|envoyé un (?:dm|message))\b|\ba (?:tapé|laissé) [«"]?[A-Z]{3,}|\bcommented\b|\breplied to my stor|\basked (?:me|about)\b|\bdm'?d me\b|\bsent me a dm\b/i, "main-levee"],
  [/\b(?:like|commente|réagit|partage) (?:souvent|tous|toutes|régulièrement)\b|\bon s'est (?:rencontrés|vus|croisés)\b|\bm'a (?:mentionné|identifié|tagué|partagé)\b|\bengages? with my\b|\bwe met\b/i, "approche-chaude"],
  [/\b(?:collab|collaboration|partenariat|partenaire|sponsor|pitcher|pitch this brand|brand deal)\b/i, "collab"],
];
const A_FROID = /\b(?:à froid|cold (?:dm|outreach|sequence)|séquence de (?:dm|messages)|prospection à froid|des inconnus|liste de (?:comptes|prospects))\b/i;
const INSISTE = /\b(?:quand même|je veux quand même|je maintiens|fais-le quand même|still want it|do it anyway)\b/i;

/** \b de JavaScript ignore « é » ; on le remplace par une borne de mot Unicode (comme en Python). */
const BORNE_UNICODE = String.raw`(?:(?<=[\p{L}\p{N}_])(?![\p{L}\p{N}_])|(?<![\p{L}\p{N}_])(?=[\p{L}\p{N}_]))`;
const U = (re: RegExp) => new RegExp(re.source.replace(/\\b/g, BORNE_UNICODE), "iu");

export function declencheurDM(demande: string): "main-levee" | "approche-chaude" | "collab" | null {
  for (const [re, type] of DECLENCHEURS) if (U(re).test(demande)) return type;
  return null;
}

/* ---------------- chiffres : jamais inventés ---------------- */
const NOMBRE = /(?<![\p{L}\p{N}])\d{1,3}(?:[\s  ]\d{3})+(?:[,.]\d+)?(?:\s?(?:€|%|k|fois|x))?|(?<![\p{L}\p{N}])\d+(?:[,.]\d+)?(?:\s?(?:€|%|k|fois|x))?|[$€]\s?\d[\d,.]*/gu;
const cle = (n: string) => n.replace(/[\s  $€%]|fois|k|x/g, "").replace(",", ".");

/**
 * Remplace par {{your number}} tout chiffre du texte qui ne figure dans aucune source fournie par
 * le propriétaire (idée, transcription, stats collées). Renvoie aussi les chiffres signalés.
 */
export function remplacerChiffresInventes(texte: string, sources: string[]) {
  const connus = new Set(sources.flatMap((s) => (s.match(NOMBRE) ?? []).map(cle)));
  const signales: string[] = [];
  const propre = texte.replace(NOMBRE, (m) => {
    if (connus.has(cle(m))) return m;
    signales.push(m.trim());
    return "{{your number}}";
  });
  const bloc = signales.length
    ? `numbers:    ${signales.length} × {{your number}} à remplir par toi (je n'invente aucun chiffre) : ${signales.join(", ")}`
    : "numbers:    tous les chiffres viennent de toi";
  return { texte: propre, signales, bloc };
}

/* ---------------- Reel : trois accroches, trois formules ---------------- */
export async function classerAccrochesReel(accroches: { formula_id: number; texte: string }[], lang: Langue = LANG): Promise<HookClassement> {
  if (accroches.length !== 3 || new Set(accroches.map((a) => a.formula_id)).size !== 3)
    throw new Error("Il faut trois accroches issues de trois formules différentes de hooks.json.");
  const r = await hookscore(accroches.map((a) => a.texte), lang);
  // La formule annoncée par Fatou fait foi (elle a écrit l'accroche à partir d'elle).
  r.resultats.forEach((x, i) => { x.formula_id = accroches[i].formula_id; });
  return r;
}

/* ---------------- légende : règles Saturn par-dessus caption.py ---------------- */
const DEMANDES_FR = /\b(?:enregistre|sauvegarde|commente|partage|envoie(?:-le)?|abonne-toi|clique|écris-moi|dis-moi|réponds|tape|garde ce post)\b/gi;
export interface LegendeLint extends Omit<CaptionLint, "fiabilite"> { reference: CaptionLint; ajustements: string[] }
/**
 * caption.py reste la référence (rendue telle quelle dans `reference`). Deux ajustements Saturn :
 *  - un lien dans la légende est un FAIL (règle : pas de lien en légende), l'original dit WARN ;
 *  - en français, les demandes (« enregistre », « commente »…) sont comptées : l'original ne lit que l'anglais.
 */
export async function lintLegende(legende: string, motsCles: string[], lang: Langue = LANG): Promise<LegendeLint> {
  const ref = await captionLint(legende, motsCles, lang);
  const ajustements: string[] = [];
  const checks = ref.checks.map((c) => ({ ...c }));
  const liens = checks.find((c) => c.check === "LINKS");
  if (liens && liens.status !== "PASS") {
    liens.status = "FAIL";
    liens.detail += " — règle Saturn : aucun lien en légende (bio ou DM).";
    ajustements.push("LINKS : WARN → FAIL (règle Saturn)");
  }
  const asks = [...ref.asks];
  if (lang === "fr") {
    const fr = legende.match(DEMANDES_FR) ?? [];
    asks.push(...fr.map((a) => a.toLowerCase()));
    const une = checks.find((c) => c.check === "ONE ASK");
    if (une && fr.length) {
      const n = asks.length;
      une.status = n === 1 ? "PASS" : "WARN";
      une.detail = n === 1 ? `1 demande : ${asks[0]}` : `${n} demandes (${asks.join(", ")}) — une seule demande par post`;
      ajustements.push("ONE ASK : demandes françaises comptées");
    }
  }
  const fails = checks.filter((c) => c.status === "FAIL").length;
  const warns = checks.filter((c) => c.status === "WARN").length;
  const { fiabilite: _f, ...base } = ref;
  return { ...base, asks, checks, verdict: fails ? "FIX" : warns ? "REVIEW" : "READY", reference: ref, ajustements };
}

/* ---------------- réponses aux commentaires : tri d'abord ---------------- */
export const ORDRE_TRI = ["KEYWORD", "LEAD", "SUBSTANCE", "QUESTION", "SUPPORT", "NOISE"] as const;
export type Bucket = (typeof ORDRE_TRI)[number];
export interface Commentaire { auteur: string; texte: string }

const BRUIT = /https?:\/\/|\blien dans (?:ma|la) bio\b|\bcheck my page\b|\bfollow ?back\b|\bf4f\b|\bgagne \d+k?\s*abonnés\b|\babonnés en \d+h\b|\b(?:t'es|tu es|vous êtes) (?:nul|nulle|nuls|con|conne)\b|\b(?:idiot|arnaqueur|escroc)\b/i;
const LEAD = /\b(?:combien|tarif|tarifs|prix|devis|budget|travailler avec (?:toi|vous)|prenez de nouveaux clients|prends de nouveaux clients|dispo(?:nible)? pour|écris-moi en dm|contacte-moi|how much|pricing|work with you|dm me)\b/i;
const mots = (t: string) => t.split(/\s+/).filter((w) => /\p{L}/u.test(w));

export function trierCommentaires(commentaires: Commentaire[], opts: { motCle?: string } = {}) {
  const motCle = opts.motCle?.toLowerCase();
  const items = commentaires.map((c) => {
    const t = c.texte.trim();
    let bucket: Bucket;
    const lettres = mots(t);
    if (BRUIT.test(t) || (/^(?:@[\w.]+\s*)+$/.test(t))) bucket = "NOISE";
    else if (motCle && lettres.length <= 2 && lettres[0]?.replace(/[^\p{L}]/gu, "").toLowerCase() === motCle) bucket = "KEYWORD";
    else if (LEAD.test(t)) bucket = "LEAD";
    else if (/\?/.test(t)) bucket = "QUESTION";
    else if (lettres.length >= 12) bucket = "SUBSTANCE";
    else bucket = "SUPPORT";
    return { ...c, bucket };
  });
  const comptes = Object.fromEntries(ORDRE_TRI.map((b) => [b, items.filter((i) => i.bucket === b).length])) as Record<Bucket, number>;
  const aRepondre = ORDRE_TRI.filter((b) => b !== "NOISE").flatMap((b) => items.filter((i) => i.bucket === b));
  return { items, comptes, aRepondre, questionsPourReel: questionsPartagees(items.filter((i) => i.bucket === "QUESTION")) };
}

/** Questions posées par au moins deux personnes (mêmes mots porteurs) → Reel formule #16. */
function questionsPartagees(questions: (Commentaire & { bucket: Bucket })[]) {
  const VIDES = new Set(["comment", "tu", "fais", "sans", "être", "pour", "quelqu'un", "un", "une", "le", "la", "les", "de", "des", "passer", "paraître", "quel", "quelle", "ça", "aussi", "c'est"]);
  const racines = (t: string) => new Set(mots(t.toLowerCase()).map((w) => w.replace(/[^\p{L}']/gu, "").slice(0, 5)).filter((w) => w.length >= 4 && !VIDES.has(w)));
  const groupes: { question: string; auteurs: string[]; formula_id: 16 }[] = [];
  const vus = new Set<number>();
  questions.forEach((q, i) => {
    if (vus.has(i)) return;
    const r = racines(q.texte);
    const groupe = [q];
    questions.forEach((o, j) => {
      if (j <= i || vus.has(j)) return;
      if ([...racines(o.texte)].some((w) => r.has(w))) { groupe.push(o); vus.add(j); }
    });
    if (groupe.length >= 2) groupes.push({ question: q.texte, auteurs: groupe.map((g) => g.auteur), formula_id: 16 });
  });
  return groupes;
}

export function resumeTri(t: ReturnType<typeof trierCommentaires>): string {
  const ligne = `Tri : ${ORDRE_TRI.map((b) => `${b} ${t.comptes[b]}`).join(" · ")}`;
  const reel = t.questionsPourReel.map((q) => `→ ${q.auteurs.length} personnes demandent « ${q.question} » : ça devient un Reel (formule #16).`);
  const bruit = t.comptes.NOISE ? [`NOISE : ${t.comptes.NOISE} commentaire(s) sans réponse (spam, insulte ou tags).`] : [];
  return [ligne, ...reel, ...bruit].join("\n");
}

/* ---------------- préparation d'un tour ---------------- */
export async function preparerTourFatou(demande: string, etat: AdaptateurEtat): Promise<Tour> {
  const refus = refusSiInterdit(demande);
  if (refus) return { type: "reponse", texte: refus, raison: "refus" };

  const r = router(demande, FATOU_SKILLS);
  if (r.type === "question") return { type: "reponse", texte: r.question, raison: "question" };
  if (r.type === "inconnu") return { type: "libre" };
  const skill = r.skill;

  const [voix, swipe, plan, log] = await Promise.all([etat.lire("voice.md"), etat.lire("swipe.md"), etat.lire("plan.md"), etat.lire("log.md")]);
  // Trois reels collés dans la demande : on peut en déduire la voix (le modèle écrit voice.md).
  const reelsColles = demande.length > 600;
  if (BESOIN_VOIX.has(skill) && !voix && !reelsColles) {
    return {
      type: "reponse", raison: "voix",
      texte: "Avant d'écrire quoi que ce soit : colle-moi trois de tes propres reels (le texte ou la transcription de ce que tu dis). J'en tire ta voix, je l'enregistre, et tout ce que je t'écris sonnera comme toi. Un texte dans la mauvaise voix est inutilisable, puisque c'est toi qui dois le dire face caméra.",
    };
  }

  if (skill === "ig-dm") {
    if (U(A_FROID).test(demande) && !U(INSISTE).test(demande)) {
      return {
        type: "reponse", raison: "dm-a-froid",
        texte: "Une séquence de DM à froid, c'est l'usage le moins rentable de ton heure. Je te propose plutôt deux semaines de commentaires utiles chez ces comptes (je les écris avec toi) : quand ils t'auront vue, le premier message sera attendu. Si tu la veux quand même, dis-le et je l'écris.",
      };
    }
    if (!declencheurDM(demande) && !U(A_FROID).test(demande)) {
      return {
        type: "reponse", raison: "dm-sans-declencheur",
        texte: "Pas de déclencheur, pas de message : un DM qui arrive de nulle part finit ignoré. Dis-moi ce que cette personne a fait : elle a commenté ou tapé un mot-clé, répondu à une story, posé une question, interagit souvent avec tes posts, ou c'est une proposition de collaboration. Je l'écris dès que j'ai ça.",
      };
    }
  }

  const etatTexte = [
    voix ? `## voice.md\n${voix}` : "## voice.md\n(absent)",
    swipe ? `## swipe.md (prioritaire sur les formules par défaut)\n${swipe}` : "",
    plan ? `## plan.md\n${plan}` : "",
    log ? `## log.md (fin)\n${log.split("\n").slice(-40).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  const contexte = `# Capacité choisie : ${skill}\nSuis ce SKILL.md tel quel (ne travaille pas de mémoire). Remplace les commandes « python3 … » par les outils du même nom.\n\n${loadSkill(skill).texte}\n\n# Fichiers d'état\n${etatTexte}`;
  return { type: "modele", skill, contexte };
}
