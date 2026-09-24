"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import { agentAvatarSrc, agentAccent } from "@/lib/agentsUI";

// Re-export helper (consommateurs existants)
export { agentGlow } from "@/lib/agentsUI";

interface AvatarProps {
  slug: string;
  /** Diamètre en px. Le composant est toujours parfaitement carré. */
  size?: number;
  className?: string;
  /** Anneau d'accent autour du cercle. */
  ring?: boolean;
  /** Halo diffus derrière l'avatar (grands formats uniquement). */
  aura?: boolean;
  priority?: boolean;
  /** Nom de l'agent — sert au texte alternatif. */
  name?: string;
}

/**
 * Avatar agent : la mascotte 3D, déjà recadrée en carré au build, affichée
 * en `object-fit: cover` dans un cercle.
 *
 * Aucun transform ni zoom compensatoire : le cadrage venant de la source,
 * il n'y a rien à rattraper en CSS, donc aucun risque de visage rogné.
 */
export function AgentAvatar({
  slug,
  size = 120,
  className,
  ring = false,
  aura = false,
  priority,
  name,
}: AvatarProps) {
  const accent = agentAccent(slug);

  return (
    <span
      className={cn("ds-avatar", className)}
      style={{
        width: size,
        height: size,
        // L'anneau est dessiné en box-shadow externe : il n'entre pas dans la
        // boîte, donc il ne rogne jamais l'image et ne décale pas le flux.
        boxShadow: ring
          ? `0 0 0 2px var(--surface-2), 0 0 0 4px ${accent}`
          : undefined,
      }}
    >
      {aura && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ boxShadow: `0 0 ${Math.round(size / 2)}px ${accent}55` }}
        />
      )}
      <Image
        src={agentAvatarSrc(slug, size)}
        alt={name ? `Portrait de ${name}` : ""}
        width={size >= 200 ? 512 : 256}
        height={size >= 200 ? 512 : 256}
        priority={priority}
        sizes={`${size}px`}
      />
    </span>
  );
}
