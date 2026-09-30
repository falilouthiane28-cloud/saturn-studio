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

/**
 * Demandes que l'agent doit refuser (en une phrase) avec l'alternative conforme.
 * On ne refuse qu'une DEMANDE d'action (verbe en tête de message, ou « à ma place »,
 * « pour moi ») : « je publie 3 reels par semaine » ou « un bot qui répond » dans un
 * contenu à rédiger ne sont pas des demandes.
 */
const EN_TETE = String.raw`^\s*(?:(?:est-ce que\s+)?(?:tu peux|peux-tu|pourrais-tu|can you|please)\s+|stp,?\s+)?`;
const POUR_MOI = String.raw`[^.?!]{0,40}(?:à ma place|pour moi|for me)`;
const D = (s: string) => new RegExp(s, "iu");
const DEMANDES_INTERDITES: [RegExp, string][] = [
  [D(`${EN_TETE}(?:poste|postes|publie|publier|poster|mets en ligne|post this|post it|publish)(?![\\p{L}])|(?<![\\p{L}])(?:poste|publie|publier|poster|post|publish)(?![\\p{L}])${POUR_MOI}`),
    "Je ne publie rien moi-même : je te prépare le texte, tu le colles et tu publies."],
  // Envoi par l'agent (« envoie ce DM ») ou envoi en masse (une action d'envoi vers N personnes).
  [D(`${EN_TETE}(?:envoie|envoyer|send)(?![\\p{L}])[^.?!]{0,40}(?<![\\p{L}])(?:dm|message|mp)s?(?![\\p{L}])|(?<![\\p{L}])(?:envoie|envoyer|send|dm|mp|écris|écrire)(?![\\p{L}])[^.?!]{0,40}\\s(?:à|a|to)\\s+\\d{2,}\\s+(?:personnes|comptes|people|accounts|prospects)(?![\\p{L}])`),
    "Je n'envoie aucun message et jamais en masse : je rédige le DM, tu l'envoies toi-même à une personne qui a déjà interagi avec toi."],
  [D(`${EN_TETE}(?:like|likes|aime|follow|suis|abonne-toi|désabonne-toi|unfollow)(?![\\p{L}])|(?<![\\p{L}])(?:like|liker|aimer|follow|suivre|s'abonner)(?![\\p{L}])${POUR_MOI}`),
    "Je n'aime et ne suis personne à ta place : je te dis qui vaut un commentaire, tu le fais toi-même."],
  [D(`${EN_TETE}(?:programme|planifie|schedule)(?![\\p{L}])[^.?!]{0,30}(?<![\\p{L}])(?:post|publication|reel|story|carrousel)s?(?![\\p{L}])`),
    "Je ne programme rien : je te donne le texte et l'heure conseillée, tu programmes dans Instagram."],
  [D(`(?<![\\p{L}])(?:voici|voilà|mon|ma|mes|donne|here's|here is|my)\\s+(?:mot de passe|password|identifiants|codes? d'accès|token)|connecte-toi (?:à|sur) (?:mon )?instagram|log ?in (?:to|on) (?:my )?instagram`),
    "Je ne me connecte jamais à Instagram et je ne demande aucun mot de passe : colle-moi le contenu, je rédige."],
  [D(`${EN_TETE}(?:scrape|scrappe|scraper|crawl|aspire|aspirer|récupère automatiquement)(?![\\p{L}])|(?<![\\p{L}])(?:scrape|scraper|scraping|crawler)(?![\\p{L}])[^.?!]{0,30}(?:instagram|reels?|comptes?|@)`),
    "Je ne scrape pas : colle-moi les contenus (ou ouvre-les toi-même, à vitesse humaine), je les analyse."],
];

/** Renvoie la phrase de refus + alternative si la demande exige une action interdite. */
export function refusSiInterdit(demande: string): string | null {
  for (const [re, reponse] of DEMANDES_INTERDITES) if (re.test(demande)) return reponse;
  return null;
}
