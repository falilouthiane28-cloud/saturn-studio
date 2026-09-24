"use client";

import Link from "next/link";
import Image from "next/image";
import { agentBannerSrc, agentAccent, isTeamLeader } from "@/lib/agentsUI";
import { LeaderBadge } from "@/components/orchestration/OrchestrationBoard";
import type { AgentMeta } from "@/lib/types";

interface AgentCardProps {
  agent: AgentMeta;
  /** Index dans la grille — sert au décalage de l'animation d'entrée. */
  index?: number;
}

/**
 * Onglet « atelier » de chaque agent, cible du bouton Exécuter.
 */
const RUN_TAB: Record<string, string> = {
  ecommerce: "studio-video",
  "createur-contenu": "content",
  veille: "veille",
  prospection: "pipeline",
  proposition: "propositions",
};

/**
 * Carte agent — refonte.
 *
 * Choix de composition (Apple : hiérarchie claire, une seule idée par zone) :
 *  1. La BANNIÈRE est le visuel héros : la figurine entière, non rognée
 *     (image 16:10 composée au build). On a SUPPRIMÉ le petit avatar rond
 *     qui doublait la mascotte — et qui, pour les agents à casque noir,
 *     disparaissait sur fond sombre. Plus de redondance, plus de contraste
 *     raté.
 *  2. Statut et badge chef sont posés EN HAUT de la bannière, sur un léger
 *     matériau translucide → lisibles sur n'importe quelle image.
 *  3. Un dégradé bas fond la bannière dans la carte : transition douce, jamais
 *     de coupe franche sous la tête.
 *  4. L'identité couleur de l'agent (accent) reste discrète : une pastille
 *     avant le rôle + l'anneau au survol. Jamais de fond de carte coloré.
 *  5. `.ds-card` reste un flex column pleine hauteur → boutons alignés entre
 *     cartes quelle que soit la longueur du texte.
 */
export function AgentCard({ agent, index = 0 }: AgentCardProps) {
  const banner = agentBannerSrc(agent.slug, 640);
  const accent = agentAccent(agent.slug);
  const href = `/agents/${agent.slug}`;
  const online = agent.status === "active";

  return (
    <article
      className="ds-card ds-card-agent ds-reveal group"
      style={{
        ["--stagger" as string]: `${index * 60}ms`,
        ["--accent" as string]: accent,
      }}
    >
      {/* --- Bannière héros : figurine entière, jamais écrasée --- */}
      <div className="ds-banner ds-banner-tall">
        {banner ? (
          <Image
            src={banner}
            alt={`${agent.name}, ${agent.role.toLowerCase()}`}
            width={640}
            height={480}
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
            priority={index < 3}
          />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: `linear-gradient(135deg, ${accent}22, transparent)` }}
          />
        )}

        {/* Dégradé bas : fond la bannière dans la carte, contraste garanti. */}
        <div aria-hidden className="ds-banner-scrim" />

        {/* Overlays haut : badge chef (gauche) + statut (droite). */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <span className="pointer-events-auto">
            {isTeamLeader(agent.slug) && <LeaderBadge compact />}
          </span>
          <span className="ds-status-chip" data-online={online}>
            <span className="ds-pill-dot" aria-hidden />
            {online ? "En ligne" : "Bientôt"}
          </span>
        </div>
      </div>

      {/* --- Corps --- */}
      <div className="flex flex-1 flex-col gap-3 px-5 pt-4 pb-5">
        <div className="min-w-0">
          <h3
            className="truncate text-[26px] leading-tight"
            style={{ fontFamily: "var(--font-serif)", color: "var(--text-1)" }}
          >
            {agent.name}
          </h3>
          <p className="ds-agent-role">
            <span className="ds-agent-dot" aria-hidden />
            {agent.role}
          </p>
        </div>

        <p
          className="ds-clamp-2 ds-desc text-sm leading-relaxed"
          style={{ color: "var(--text-2)" }}
        >
          {agent.tagline}
        </p>

        {/* --- Actions, toujours collées en bas --- */}
        <div className="ds-spacer grid grid-cols-[1fr_auto_auto] gap-2 pt-1">
          <Link
            href={href}
            className="ds-btn ds-btn-primary"
            aria-label={`Discuter avec ${agent.name}`}
          >
            Chat
          </Link>
          <Link
            href={`${href}?tab=${RUN_TAB[agent.slug] ?? "analytics"}`}
            className="ds-btn ds-btn-ghost"
            aria-label={`Ouvrir l'atelier de ${agent.name}`}
          >
            Exécuter
          </Link>
          <Link
            href={`${href}?tab=files`}
            className="ds-btn ds-btn-ghost"
            aria-label={`Voir les détails de ${agent.name}`}
          >
            Détails
          </Link>
        </div>
      </div>
    </article>
  );
}
