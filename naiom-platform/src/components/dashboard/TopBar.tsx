import Link from "next/link";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

interface TopBarProps {
  title: string;
  /** Nombre d'agents actifs, affiché dans la pastille de statut. */
  onlineCount: number;
  /** Nombre de notifications non lues (0 = pas de badge). */
  notifications?: number;
}

/**
 * Barre supérieure du shell applicatif : titre de page, pastille de statut,
 * puis les actions globales (notifications, thème, connexions).
 *
 * Toutes les actions icône-seule portent un aria-label : une icône sans nom
 * accessible est invisible pour un lecteur d'écran.
 */
export function TopBar({ title, onlineCount, notifications = 0 }: TopBarProps) {
  return (
    // top-[76px] : AppNav est une pilule `fixed top-0` d'environ 70px de haut.
    // La TopBar se cale juste en dessous au lieu de passer sous elle.
    <header
      className="sticky top-[76px] z-30 border-b backdrop-blur"
      style={{
        borderColor: "var(--line-1)",
        background: "color-mix(in srgb, var(--surface-0) 88%, transparent)",
      }}
    >
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-6 py-4 sm:px-10">
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ color: "var(--text-1)" }}
        >
          {title}
        </h1>

        <span className="ds-pill ds-pill-ok">
          <span className="ds-pill-dot" aria-hidden />
          {onlineCount} agent{onlineCount > 1 ? "s" : ""} en ligne
        </span>

        <div className="ms-auto flex items-center gap-1.5">
          <Link
            href="/settings"
            className="ds-icon-btn relative"
            aria-label={
              notifications > 0
                ? `Notifications, ${notifications} non lues`
                : "Notifications"
            }
          >
            <Icon name="Bell" size={16} />
            {notifications > 0 && (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full"
                style={{ background: "var(--brand)" }}
              />
            )}
          </Link>

          <ThemeToggle className="ds-icon-btn" />

          <Link href="/settings" className="ds-icon-btn" aria-label="Connexions et réglages">
            <Icon name="Settings" size={16} />
          </Link>
        </div>
      </div>
    </header>
  );
}
