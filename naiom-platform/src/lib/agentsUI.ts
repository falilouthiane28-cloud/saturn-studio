/**
 * Helpers UI liés aux agents, utilisables côté client ET serveur.
 * (Pas de directive "use client" — pures fonctions utilitaires.)
 *
 * IMPORTANT : ce module ne doit JAMAIS importer `node:fs` ni `@/lib/agents`,
 * qui en dépend. Il est importé par des composants client ; y faire entrer un
 * module serveur casse le bundle (« does not support external modules »).
 */
import type { AgentSlug } from "@/lib/types";

/**
 * Chef d'équipe — déclaré ici, et non dans `agents.ts`, pour rester
 * accessible aux composants client (le badge sur la carte agent).
 *
 * Choix dicté par les modules métier eux-mêmes :
 *  - `fireflies` est le seul dont le livrable est explicitement collectif
 *    (« résumés + plans d'action équipe + priorités de relance ») ;
 *  - `proposition.md` le nomme comme dépendance amont, dans une section
 *    « Ta place dans la chaîne ». Le passage de relais est déjà écrit dans
 *    les prompts ; l'orchestration ne fait que le rendre visible.
 */
export const TEAM_LEADER_SLUG: AgentSlug = "fireflies";

export function isTeamLeader(slug: string): boolean {
  return slug === TEAM_LEADER_SLUG;
}

/* ============================================================
   VISUELS AGENTS — mascottes 3D
   ------------------------------------------------------------
   Les six agents ont tous une mascotte, déclinée au build par
   `scripts/build_avatars.py` en quatre variantes :

     <slug>-avatar-{256,512}.webp   tête + épaules, carré  → cercles
     <slug>-banner-{640,1280}.webp  16:10 composé          → cartes studio
     <slug>-portrait-640.webp       3:4 buste              → fiche agent
     <slug>-figure-{640,960}.webp   figurine entière       → hero

   Le cadrage est fait À LA SOURCE, pas en CSS. C'est ce qui élimine
   le bug des visages rognés : les images d'origine ont des ratios
   très différents (Emma 0.56 · Ousmane 0.75 · les autres 1.00), et
   aucune règle CSS unique ne peut les cadrer toutes correctement.

   Il n'y a plus de repli « figurine Funko » : chaque agent réel a
   sa mascotte, et un slug sans mascotte n'est plus un agent.
   ============================================================ */

/** Avatar carré (tête + épaules). `size` choisit la déclinaison la plus proche. */
export function agentAvatarSrc(slug: string, size = 256): string {
  return `/agents/${slug}-avatar-${size > 256 ? 512 : 256}.webp`;
}

/** Bannière paysage 16:10 — figurine entière sur décor flouté, jamais coupée. */
export function agentBannerSrc(slug: string, width = 640): string {
  return `/agents/${slug}-banner-${width > 640 ? 1280 : 640}.webp`;
}

/** Portrait 3:4 pour la colonne gauche de la fiche agent. */
export function agentPortraitSrc(slug: string): string {
  return `/agents/${slug}-portrait-640.webp`;
}

/** Figurine entière, marges de décor retirées — pour le hero de la landing. */
export function agentFigureSrc(slug: string, width = 640): string {
  return `/agents/${slug}-figure-${width > 640 ? 960 : 640}.webp`;
}

/**
 * Couleur d'accent par agent — utilisée UNIQUEMENT en anneau/halo discret
 * autour de l'avatar, jamais en fond de carte (sinon effet « template
 * arc-en-ciel » que la refonte cherche précisément à supprimer).
 *
 * Toutes les teintes sont prises dans le voisinage du violet de marque
 * (indigo → magenta) : elles distinguent les agents sans concurrencer
 * l'accent primaire. Aucune teinte orange ne subsiste.
 */
export const AGENT_ACCENT: Record<string, string> = {
  ecommerce: "#9333EA", // violet
  "createur-contenu": "#7C3AED", // violet profond
  veille: "#C026D3", // fuchsia
  prospection: "#4F46E5", // indigo
  fireflies: "#6366F1", // indigo clair
  proposition: "#A21CAF", // magenta
};

/** Repli : l'accent de marque, lu depuis le token — jamais une valeur en dur. */
export function agentAccent(slug: string): string {
  return AGENT_ACCENT[slug] ?? "var(--color-primary)";
}

/** Halo diffus derrière un avatar, dérivé de son accent. */
export function agentGlow(slug: string): string {
  return `color-mix(in srgb, ${agentAccent(slug)} 30%, transparent)`;
}
