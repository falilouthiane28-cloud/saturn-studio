/**
 * Registre des outils exposés aux agents Instagram (Fatou, Nina). Uniquement des calculs locaux
 * et la lecture/écriture des fichiers d'état : aucun outil ne touche Instagram (garde vérifiée ici).
 */
import { exigerBrouillonSeulement, type OutilAgent } from "./guard.ts";

export const OUTILS: Record<string, OutilAgent> = {
  charger_skill: { name: "charger_skill", description: "Charge le texte intégral d'un SKILL.md du pack (à suivre tel quel)." },
  hookscore: { name: "hookscore", description: "Note une ou plusieurs accroches (5 contrôles) et les classe ; formule reconnue pour chacune." },
  beats: { name: "beats", description: "Découpe minutée d'un script de Reel, avec durée cible et alertes à corriger." },
  caption_lint: { name: "caption_lint", description: "Contrôle d'une légende : troncature, liens, hashtags, une seule demande, mots-clés de recherche." },
  humanize: { name: "humanize", description: "Nettoie un brouillon des tics de rédaction machine et rend le rapport des changements." },
  detect: { name: "detect", description: "Panneau de cinq contrôles locaux (heuristiques, pas un détecteur commercial), seul ou avant/après." },
  ig_human: { name: "ig_human", description: "Passage obligatoire : humanize puis detect ; renvoie le texte ET le score." },
  swipe: { name: "swipe", description: "Classe les reels relevés par le propriétaire selon leur écart à la médiane de leur compte ; attribution obligatoire." },
  classer_accroches_reel: { name: "classer_accroches_reel", description: "Trois accroches de trois formules différentes, notées et classées." },
  detect_avant_apres: { name: "detect_avant_apres", description: "Panneau de détection avant / après." },
  verifier_chiffres: { name: "verifier_chiffres", description: "Remplace tout chiffre non fourni par le propriétaire par {{your number}}." },
  trier_commentaires: { name: "trier_commentaires", description: "Tri des commentaires collés en six catégories, comptes annoncés avant les réponses." },
  score_profil: { name: "score_profil", description: "Additionne les notes par critère de la grille rubric.json (sur 100)." },
  lire_etat: { name: "lire_etat", description: "Lit voice.md, swipe.md, log.md ou plan.md." },
  ecrire_etat: { name: "ecrire_etat", description: "Écrit voice.md, swipe.md ou plan.md (log.md : ajout seulement, après le « oui » du propriétaire)." },
  journaliser: { name: "journaliser", description: "Ajoute une ligne à log.md, uniquement si le propriétaire a répondu « oui »." },
  passer_relais: { name: "passer_relais", description: "Crée une enveloppe de relais entre Fatou et Nina." },
  generer_video: { name: "generer_video", description: "Génère un plan vidéo motion design (Higgsfield Seedance 2.5), uniquement après le « oui » du propriétaire." },
  statut_video: { name: "statut_video", description: "Suit un job Higgsfield (vidéo ou image clé) et renvoie l'URL du fichier quand il est prêt." },
  plan_video_motion: { name: "plan_video_motion", description: "Découpe une vidéo motion design en scènes, avec timecodes et prompts au style actif." },
  verifier_narration: { name: "verifier_narration", description: "Longueur de narration (2,5 mots/s) et passage ig-human (≥ 70)." },
  generer_image_cle: { name: "generer_image_cle", description: "Image clé 9:16 d'une scène (Higgsfield), après le « oui » du propriétaire." },
  animer_scene: { name: "animer_scene", description: "Anime une image clé générée par Fatou (Higgsfield image → vidéo), après le « oui »." },
  assembler_video: { name: "assembler_video", description: "Colle les clips des scènes en une vidéo finale MP4 servie par le site." },
  ajouter_style_motion: { name: "ajouter_style_motion", description: "Ajoute un style de motion design à motion-styles.json." },
};

const liste = (noms: string[]) => noms.map((n) => OUTILS[n]);

export const OUTILS_FATOU = liste(["charger_skill", "hookscore", "classer_accroches_reel", "beats", "caption_lint", "ig_human", "detect_avant_apres", "verifier_chiffres", "trier_commentaires", "lire_etat", "ecrire_etat", "journaliser", "passer_relais", "generer_video", "statut_video", "plan_video_motion", "verifier_narration", "generer_image_cle", "animer_scene", "assembler_video", "ajouter_style_motion"]);
export const OUTILS_NINA = liste(["charger_skill", "hookscore", "humanize", "detect", "ig_human", "swipe", "score_profil", "lire_etat", "ecrire_etat", "journaliser", "passer_relais"]);

// Refus au chargement si un outil de publication s'était glissé dans une liste.
exigerBrouillonSeulement(OUTILS_FATOU);
exigerBrouillonSeulement(OUTILS_NINA);
