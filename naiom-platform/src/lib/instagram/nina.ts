/**
 * Nina, agente Instagram (intelligence et stratégie) : garde-fous déterministes autour des
 * 4 skills (ig-viral, ig-audit, ig-plan, ig-profile) plus ig-human obligatoire sur les rewrites.
 * Elle ne publie rien, ne se connecte jamais, ne scrape jamais : elle mesure, plan-ifie, corrige.
 * Toute conclusion produite par Nina qui doit être écrite par Fatou passe par un handoff
 * (Enveloppe) avec la formule choisie + la version du propriétaire de l'accroche.
 */
import { refusSiInterdit } from "./guard.ts";
import { router } from "./router.ts";
import { loadSkill, type SkillName } from "./skillLoader.ts";
import type { AdaptateurEtat } from "./stateStore.ts";
import { creerEnveloppe, type Enveloppe } from "./handoff.ts";
import { auditerPosts, type AuditResultat, type PostRow } from "./audit.ts";

export const NINA_SKILLS: readonly SkillName[] = ["ig-viral", "ig-audit", "ig-plan", "ig-profile", "ig-human"];

/* ---------------- outlier signal / bruit ---------------- */

/**
 * Un reel n'est un signal que si son écart à sa propre médiane est significatif.
 *  ≥ 3   = signal fort  ("outlier")
 *  ≥ 1.5 = surperformance à surveiller
 *  <  1.5 = journée normale du compte, sans enseignement
 * Les vues brutes ne comptent jamais : un 2M followers à 1.2x est du bruit,
 * un 4k followers à 40x est de l'or.
 */
export type Signal = "outlier" | "surperformance" | "bruit";
export function classifierMultiple(views: number, accountMedianViews: number): Signal {
  const m = accountMedianViews > 0 ? views / accountMedianViews : 0;
  if (m >= 3) return "outlier";
  if (m >= 1.5) return "surperformance";
  return "bruit";
}

/** Comptes hors bande (≥10x la taille du propriétaire) : format seulement, jamais tempo ni ton. */
export function borneComptes(followersProprio: number, followersCompte: number): "dans-bande" | "outsized-format-only" {
  return followersCompte > followersProprio * 10 ? "outsized-format-only" : "dans-bande";
}

/** Pas de finding en dessous de 15 reels observés. */
export function refuserSiEchantillonInsuffisant(n: number): { ok: boolean; message: string } {
  if (n < 15) return { ok: false, message: `Échantillon trop court : ${n} reels observés. Je peux te lister ce que je vois, mais pas nommer une formule gagnante avant 15 minimum (idéalement 30).` };
  return { ok: true, message: `${n} reels observés : suffisant pour dégager une tendance.` };
}

/* ---------------- ig-plan : validation stricte ---------------- */

export type TypePost = "reel" | "carrousel" | "story" | "photo";
export type Angle = "proof" | "teach" | "opinion" | "story" | "offer";

export interface CreneauPlan {
  jour: string;                // "lun", "mar", ...
  type: TypePost;
  theme: string;
  angle: Angle;
  hook_formula_id: number;     // 1..26 (référence hooks.json)
  hook_line: string;           // version du propriétaire
}

export interface CibleEngagement { compte: string; role: "reach" | "peer" | "buyer" }

export interface Plan {
  creneaux: CreneauPlan[];     // 4-5 slots
  engagement: CibleEngagement[]; // exactement 10 : 5 reach, 3 peers, 2 buyers
}

export interface VerdictPlan { valide: boolean; erreurs: string[] }

/** Vérifications déterministes du plan hebdomadaire (règles ig-plan). */
export function verifierPlan(p: Plan): VerdictPlan {
  const erreurs: string[] = [];
  if (p.creneaux.length < 4 || p.creneaux.length > 5) erreurs.push(`4 à 5 slots requis, reçu ${p.creneaux.length}.`);
  const reels = p.creneaux.filter((c) => c.type === "reel").length;
  if (reels < 3) erreurs.push(`au moins 3 Reels requis, reçu ${reels}.`);
  for (let i = 1; i < p.creneaux.length; i++) if (p.creneaux[i].type === p.creneaux[i - 1].type)
    erreurs.push(`slots ${i} et ${i + 1} sont deux ${p.creneaux[i].type} consécutifs.`);
  for (const [i, c] of p.creneaux.entries()) {
    if (!(Number.isInteger(c.hook_formula_id) && c.hook_formula_id >= 1 && c.hook_formula_id <= 26))
      erreurs.push(`slot ${i + 1} : hook_formula_id doit être 1..26, reçu ${c.hook_formula_id}.`);
    if (!c.hook_line?.trim()) erreurs.push(`slot ${i + 1} : hook_line vide (accroche du propriétaire manquante).`);
    if (!c.theme?.trim() || !c.angle) erreurs.push(`slot ${i + 1} : theme ou angle manquant.`);
  }
  if (p.engagement.length !== 10) erreurs.push(`liste d'engagement : exactement 10 comptes, reçu ${p.engagement.length}.`);
  const reach = p.engagement.filter((e) => e.role === "reach").length;
  const peers = p.engagement.filter((e) => e.role === "peer").length;
  const buyers = p.engagement.filter((e) => e.role === "buyer").length;
  if (reach !== 5 || peers !== 3 || buyers !== 2)
    erreurs.push(`répartition 5 reach / 3 peers / 2 buyers requise, reçu ${reach}/${peers}/${buyers}.`);
  return { valide: erreurs.length === 0, erreurs };
}

/* ---------------- handoff Nina → Fatou (top 3 formules) ---------------- */

export interface FormuleGagnante { formula_id: number; source_account: string; owner_hook: string; evidence: string }

/** Trois enveloppes vers Fatou : chaque formule top vient avec la version du propriétaire. */
export function relaisTopFormules(formules: FormuleGagnante[]): Enveloppe[] {
  if (formules.length !== 3) throw new Error("relaisTopFormules attend exactement 3 formules.");
  return formules.map((f) => creerEnveloppe({
    from: "nina", to: "fatou", capability: "ig-reel",
    formula_id: f.formula_id,
    angle: f.owner_hook,           // jamais le script de l'autre — la version que le propriétaire dirait
    source_account: f.source_account,
    evidence: f.evidence,
  }));
}

/* ---------------- audit : passerelle typée ---------------- */

/** Audit + routage automatique : « vues sans follows » → ig-profile, « pas de vues » → ig-viral. */
export function auditNina(rows: PostRow[]): AuditResultat { return auditerPosts(rows); }

/* ---------------- préparation d'un tour de Nina ---------------- */

export type Tour =
  | { type: "reponse"; texte: string; raison: "refus" | "question" | "hors-perimetre" }
  | { type: "modele"; skill: SkillName; contexte: string }
  | { type: "libre" };

/**
 * Prépare le tour de Nina exactement comme `preparerTourFatou` : refus, routage, chargement
 * du SKILL.md tel quel, injection des fichiers d'état lisibles. Rien qui touche IG.
 */
export async function preparerTourNina(demande: string, etat: AdaptateurEtat): Promise<Tour> {
  const refus = refusSiInterdit(demande);
  if (refus) return { type: "reponse", texte: refus, raison: "refus" };

  const r = router(demande, NINA_SKILLS);
  if (r.type === "question") return { type: "reponse", texte: r.question, raison: "question" };
  if (r.type === "inconnu") return { type: "libre" };
  const skill = r.skill;

  const [voix, swipe, plan, log] = await Promise.all([
    etat.lire("voice.md"), etat.lire("swipe.md"), etat.lire("plan.md"), etat.lire("log.md"),
  ]);
  const etatTexte = [
    voix ? `## voice.md\n${voix}` : "## voice.md\n(absent)",
    swipe ? `## swipe.md\n${swipe}` : "",
    plan ? `## plan.md\n${plan}` : "",
    log ? `## log.md (fin)\n${log.split("\n").slice(-40).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");

  const rappel = `# Rappels Nina\n- ig-viral : mensuel, jamais quotidien. Comptes dans ~10× la taille du propriétaire ; les plus gros pour le format seulement.\n- ig-audit : classer par outlier_multiple et sends_per_reach, jamais par vues. Day/time présentés en dernier.\n- ig-plan : 4-5 slots, ≥3 Reels, pas deux mêmes types adjacents, formule par slot, engagement 5/3/2.\n- ig-profile : rubrique honnête, réécritures dans l'ordre des points perdus, re-score et delta réel.\n- Toute réécriture (bio, name field, highlights, hook du plan) passe par ig-human avant d'être montrée.\n- Enveloppe (creerEnveloppe) obligatoire quand une formule part vers Fatou : formula_id + version du propriétaire.\n`;
  const contexte = `# Capacité choisie : ${skill}\nSuis ce SKILL.md tel quel (ne travaille pas de mémoire). Remplace les commandes « python3 … » par les outils du même nom (swipe, hookscore, humanize, detect, score_profil).\n\n${loadSkill(skill).texte}\n\n${rappel}\n# Fichiers d'état\n${etatTexte}`;
  return { type: "modele", skill, contexte };
}
