import { clsx } from "clsx";

interface SaturnLogoProps {
  /**
   * `full` : wordmark + ligne « DESIGN STUDIO » (pieds de page, écrans d'accueil).
   * `compact` : wordmark seul (barres de navigation, où la hauteur est comptée).
   */
  variant?: "full" | "compact";
  /** Hauteur de la capitale S, en px. Tout le reste est proportionnel. */
  size?: number;
  className?: string;
}

/**
 * Logotype Saturn Studio.
 *
 * Rendu en texte et non en image : la couleur suit `currentColor`, donc le
 * logo s'inverse tout seul en blanc sur fond sombre sans seconde version de
 * fichier à maintenir. Il reste aussi net à toute taille et sélectionnable.
 *
 * Le `aria-label` porte le nom complet : visuellement « SATURN » et
 * « DESIGN STUDIO » sont deux blocs, mais un lecteur d'écran doit entendre
 * une seule marque.
 */
export function SaturnLogo({
  variant = "full",
  size = 20,
  className,
}: SaturnLogoProps) {
  return (
    <span
      className={clsx("inline-flex flex-col leading-none", className)}
      role="img"
      aria-label="Saturn Studio"
      style={{ color: "currentColor" }}
    >
      <span
        aria-hidden
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          fontSize: size,
          // Le wordmark de référence est très serré : les lettres se touchent
          // presque. -0.045em reproduit cette densité sans collision.
          letterSpacing: "-0.045em",
          lineHeight: 1,
          textTransform: "uppercase",
        }}
      >
        Saturn
      </span>

      {variant === "full" && (
        <span
          aria-hidden
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            // ~0.30x le corps du wordmark, aligné optiquement dessous.
            fontSize: Math.max(7, Math.round(size * 0.3)),
            letterSpacing: "0.38em",
            lineHeight: 1,
            textTransform: "uppercase",
            // L'interlettrage pousse un vide à droite : on le compense pour
            // que le bloc reste aligné à gauche avec le wordmark.
            marginInlineEnd: "-0.38em",
            marginBlockStart: Math.round(size * 0.22),
            opacity: 0.85,
          }}
        >
          Design Studio
        </span>
      )}
    </span>
  );
}
