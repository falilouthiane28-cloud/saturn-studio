/**
 * Garde « brouillon seulement » : aucun outil d'agent Instagram ne publie, n'envoie, ne commente,
 * n'aime, ne suit, n'écrit en DM ni ne programme sur Instagram. Les agents rédigent ; le
 * propriétaire colle et publie. Vérifié à l'enregistrement des outils et par test.
 */
export interface OutilAgent { name: string; description: string; endpoint?: string }

const HOTES_INTERDITS = /(?:^|[/.@])(?:instagram\.com|graph\.facebook\.com|graph\.instagram\.com|i\.instagram\.com)\b/i;
// Bornes sur « _ » (dans un nom d'outil, « _ » sépare les mots alors que \b le compte comme une lettre).
const ACTIONS_INTERDITES = /(?:^|_)(?:publish|post_to|posts?_on|share_to|send_dm|dm_send|direct_message|comment_on|like|follow|unfollow|schedule|auto_?reply|bulk_?dm|publier|publie|envoyer_dm|commenter_sur|aimer|suivre|programmer|planifier_publication)(?:_|$)/i;

export function violationsBrouillon(outils: OutilAgent[]): string[] {
  const v: string[] = [];
  for (const o of outils) {
    if (o.endpoint && HOTES_INTERDITS.test(o.endpoint)) v.push(`${o.name} vise ${o.endpoint}`);
    if (ACTIONS_INTERDITES.test(o.name.replace(/[-\s]/g, "_"))) v.push(`${o.name} : nom d'outil d'action sur Instagram`);
    if (HOTES_INTERDITS.test(o.description)) v.push(`${o.name} : description qui vise Instagram`);
  }
  return v;
}

/** À appeler à l'enregistrement de la liste d'outils d'un agent : refuse toute action de publication. */
export function exigerBrouillonSeulement(outils: OutilAgent[]): void {
  const v = violationsBrouillon(outils);
  if (v.length) throw new Error(`Garde brouillon-seulement : ${v.join(" ; ")}`);
}

/** Demandes que l'agent doit refuser (en une phrase) avec l'alternative conforme. */
const DEMANDES_INTERDITES: [RegExp, string][] = [
  [/\b(?:poste|publie|publier|poster|post(?:e|s)? (?:ça|le|la|ce)|post this|publish)\b/i, "Je ne publie rien moi-même : je te prépare le texte, tu le colles et tu publies."],
  [/\b(?:envoie|envoyer|send)\b[^.?!]{0,40}\b(?:dm|message|mp)s?\b|\b\d{2,}\s+(?:personnes|comptes|people|accounts)\b/i, "Je n'envoie aucun message et jamais en masse : je rédige le DM, tu l'envoies toi-même à une personne qui a déjà interagi avec toi."],
  [/\b(?:like|aime|follow|suis|abonne-toi|unfollow)\b[^.?!]{0,30}\b(?:compte|comptes|posts?|accounts?)\b/i, "Je n'aime et ne suis personne à ta place : je te dis qui vaut un commentaire, tu le fais toi-même."],
  [/\b(?:programme|planifie|schedule)\b[^.?!]{0,30}\b(?:post|publication|reel|story)\b/i, "Je ne programme rien : je te donne le texte et l'heure conseillée, tu programmes dans Instagram."],
  [/\b(?:mot de passe|password|identifiants|token|connecte-toi à (?:mon )?instagram|log ?in)\b/i, "Je ne me connecte jamais à Instagram et je ne demande aucun mot de passe : colle-moi le contenu, je rédige."],
  [/\b(?:scrape|scraper|scraping|crawl|aspire|aspirer|bot)\b/i, "Je ne scrape pas : colle-moi les contenus (ou ouvre-les toi-même, à vitesse humaine), je les analyse."],
];

/** Renvoie la phrase de refus + alternative si la demande exige une action interdite. */
export function refusSiInterdit(demande: string): string | null {
  for (const [re, reponse] of DEMANDES_INTERDITES) if (re.test(demande)) return reponse;
  return null;
}
