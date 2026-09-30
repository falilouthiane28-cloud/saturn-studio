/**
 * Routeur : demande → une capacité (un skill). Déclencheurs = phrases citées dans chaque
 * description de SKILL.md, plus leurs équivalents français. Deux capacités à égalité :
 * on pose une question courte, on ne devine jamais.
 */
import type { SkillName } from "./skillLoader.ts";

const D: Record<SkillName, { en: string[]; fr: string[]; libelle: string }> = {
  "ig-reel": {
    libelle: "un Reel (script, accroche, texte à l'écran)",
    en: ["reel", "short-form video", "video script", "hook", "voiceover", "make a reel", "what should i say in this video", "about to record"],
    fr: ["(?:écris|rédige|prépare|fais)(?:-moi)? (?:un|le|ce) (?:reel|script de reel)", "fais-moi un reel", "fait moi un reel", "un reel", "script vidéo", "script de vidéo", "accroche", "hook", "voix off", "qu'est-ce que je dis dans (cette|la) vidéo", "je vais filmer", "je vais tourner", "vidéo courte"],
  },
  "ig-caption": {
    libelle: "une légende",
    en: ["caption", "write the caption", "caption this", "what do i put in the description", "hashtags?"],
    fr: ["légende", "écris la légende", "ecris la legende", "texte sous (le|la) (post|reel|vidéo)", "description du post", "hashtags?"],
  },
  "ig-carousel": {
    libelle: "un carrousel",
    en: ["carousel", "slides", "swipe post", "turn this into a carousel"],
    fr: ["carrousel", "carousel", "slides", "diapos", "post à faire défiler", "transforme (ça|ceci) en carrousel"],
  },
  "ig-story": {
    libelle: "des Stories",
    en: ["stories", "story", "story sequence", "poll idea", "nothing to story about"],
    fr: ["stories", "story", "séquence de stories", "sondage", "quoi mettre en story", "rien à mettre en story"],
  },
  "ig-repurpose": {
    libelle: "le recyclage d'un contenu long en posts",
    en: ["repurpose", "turn this into reels", "podcast", "transcript", "cut this up", "youtube video", "newsletter", "livestream"],
    fr: ["recycle", "recycler", "décline(r)? (ce|cette|ma)", "transforme (ça|ceci|cette vidéo|ce podcast) en reels", "podcast", "transcription", "découpe (ça|cette vidéo)", "vidéo youtube", "newsletter", "live"],
  },
  "ig-comment": {
    libelle: "un commentaire sous le post de quelqu'un d'autre",
    en: ["comment on this", "engage with this", "what do i say here", "engagement round", "write a comment"],
    fr: ["commente (ce|cette|ça)", "commenter (ce|cette|chez)", "écris un commentaire", "laisse un commentaire", "tournée d'engagement", "engagement"],
  },
  "ig-reply": {
    libelle: "les réponses aux commentaires sous tes posts",
    en: ["reply to these", "handle my comments", "someone said", "hater", "critic", "my comments"],
    fr: ["réponds aux commentaires", "reponds aux commentaires", "réponds à (ces|mes) commentaires", "gère mes commentaires", "quelqu'un a (dit|écrit)", "haineux", "rageux", "critique sous mon"],
  },
  "ig-dm": {
    libelle: "un DM",
    en: ["dm", "what do i send them", "outreach message", "follow up", "pitch this brand", "direct message"],
    fr: ["(?:écris|rédige|prépare)(?:-moi)? (?:un|le|ce) (?:dm|message privé|mp)", "dm", "message privé", "mp", "qu'est-ce que je (leur|lui) envoie", "message de prospection", "relance", "relancer", "proposer une collab", "pitcher (cette|une) marque"],
  },
  "ig-human": {
    libelle: "humaniser un texte",
    en: ["humanize", "does this sound like ai", "remove the em dashes", "de-slop", "sounds like chatgpt"],
    fr: ["humanise", "humaniser", "ça sonne ia", "ça fait ia", "ça fait chatgpt", "enlève les tirets", "retire le style ia"],
  },
  "ig-viral": {
    libelle: "chercher ce qui marche dans ta niche",
    en: ["find viral videos", "what's working right now", "what are people posting in my niche", "reverse engineer this account", "swipe file", "doing numbers"],
    fr: ["trouve ce qui marche", "ce qui marche dans ma niche", "vidéos virales", "qu'est-ce qui marche en ce moment", "décortique ce compte", "swipe file", "fichier d'inspiration", "fait des vues"],
  },
  "ig-audit": {
    libelle: "l'audit de ce que tu as déjà publié",
    en: ["what's working", "why did this flop", "read my analytics", "audit my content", "insights"],
    fr: ["audite mon compte", "audit de mon compte", "audite mes posts", "pourquoi ça a floppé", "pourquoi ça n'a pas marché", "lis mes stats", "mes statistiques", "analyse mes posts"],
  },
  "ig-plan": {
    libelle: "le plan de ta semaine",
    en: ["plan my week", "what should i post", "content calendar", "nothing to post", "posting schedule"],
    fr: ["plan de ma semaine", "planifie ma semaine", "planning", "calendrier éditorial", "calendrier de contenu", "quoi poster", "je sais pas quoi poster", "rien à poster"],
  },
  "ig-profile": {
    libelle: "l'optimisation de ton profil",
    en: ["optimize my profile", "fix my bio", "score my instagram", "why don't people follow me", "my profile"],
    fr: ["optimise mon profil", "optimiser mon profil", "corrige ma bio", "ma bio", "note mon profil", "pourquoi on ne me suit pas", "mon profil"],
  },
};

const normaliser = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
const motifs = new Map<SkillName, RegExp[]>(
  (Object.keys(D) as SkillName[]).map((k) => [k, [...D[k].en, ...D[k].fr].map((t) => new RegExp(`(?<![\\p{L}])${t}(?![\\p{L}])`, "iu"))]),
);

export type Routage =
  | { type: "capacite"; skill: SkillName }
  | { type: "question"; question: string; options: SkillName[] }
  | { type: "inconnu"; question: string };

/** Choisit la capacité ; `permis` restreint aux skills de l'agent (Fatou, Nina…). */
export function router(demande: string, permis: readonly SkillName[] = Object.keys(D) as SkillName[]): Routage {
  const t = normaliser(demande);
  // Score d'une capacité = longueur du déclencheur le plus précis trouvé (« réponds aux
  // commentaires » l'emporte sur « reel »). Deux candidats proches (≥ 50 %) : on demande.
  const scores = permis
    .map((k) => ({ k, n: Math.max(0, ...(motifs.get(k) ?? []).map((re) => re.exec(t)?.[0].length ?? 0)) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n);
  if (!scores.length) return { type: "inconnu", question: `Tu veux quoi exactement : ${permis.map((k) => D[k].libelle).join(", ")} ?` };
  if (scores.length > 1 && scores[1].n >= scores[0].n * 0.5) {
    const options = scores.filter((s) => s.n >= scores[0].n * 0.5).map((s) => s.k);
    return { type: "question", question: `Tu veux ${options.map((k) => D[k].libelle).join(" ou ")} ?`, options };
  }
  return { type: "capacite", skill: scores[0].k };
}
