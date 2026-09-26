"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SaturnLogo } from "@/components/brand/SaturnLogo";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { MobileTabBar } from "@/components/nav/MobileTabBar";
import { LogoutButton } from "@/components/nav/LogoutButton";

/**
 * Barre de navigation du Studio (pages internes).
 *
 * UNE seule couche de chrome, pleine largeur et collante (`.studio-bar`).
 * Elle remplace l'ancien duo « pilule flottante + TopBar collante » : les deux
 * se superposaient et, comme la pilule flottait sur un fond transparent, le
 * contenu défilait par-dessus (bannières des cartes qui remontaient autour du
 * logo). Ici le contenu passe proprement SOUS un matériau translucide unique.
 *
 * Les actions globales (notifications, thème, réglages) — jadis dans la TopBar —
 * vivent désormais à droite de cette barre, donc présentes sur toutes les pages
 * internes de façon cohérente.
 *
 * L'état actif est déduit du pathname : ajouter une entrée à LINKS suffit.
 */
const LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/dashboard", label: "Studio" },
  { href: "/bases", label: "Les bases" },
  { href: "/live", label: "Coulisses" },
  { href: "/calendrier", label: "Calendrier" },
  { href: "/install", label: "Installer" },
  { href: "/vps", label: "Héberger" },
  { href: "/settings", label: "Connexions" },
] as const;

/**
 * Une entrée est active si le pathname lui correspond exactement, ou s'il en
 * est un sous-chemin (`/agents/...` garde « Studio » allumé). La racine est
 * traitée à part, sinon elle serait préfixe de tout.
 */
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname() ?? "/";
  // Les fiches agent appartiennent au Studio : on y garde la pilule allumée.
  const effective = pathname.startsWith("/agents/") ? "/dashboard" : pathname;

  return (
    <>
    <header className="studio-bar">
      <div className="studio-bar-inner">
        <Link
          href="/"
          aria-label="Saturn Studio — accueil"
          className="studio-bar-logo"
        >
          <SaturnLogo variant="compact" size={20} />
        </Link>

        <nav aria-label="Navigation principale" className="studio-tabs">
          {LINKS.map((l) => {
            const active = isActive(effective, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`studio-tab ${active ? "active" : ""}`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="studio-bar-actions">
          <Link href="/settings" className="ds-icon-btn" aria-label="Notifications">
            <Icon name="Bell" size={16} />
          </Link>
          <ThemeToggle className="ds-icon-btn" />
          <Link
            href="/settings"
            className="ds-icon-btn"
            aria-label="Connexions et réglages"
          >
            <Icon name="Settings" size={16} />
          </Link>
          <LogoutButton />
        </div>
      </div>
    </header>
    {/* Hors du <header> : son backdrop-filter piégerait le position:fixed. */}
    <MobileTabBar />
    </>
  );
}
