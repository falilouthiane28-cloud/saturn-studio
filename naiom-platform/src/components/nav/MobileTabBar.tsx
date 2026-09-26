"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

/**
 * Barre d'onglets mobile (≤ 768 px), modèle iOS : 4 destinations principales
 * toujours visibles + « Plus » qui ouvre une feuille avec le reste.
 * Masquée au-delà de 768 px (la barre du haut suffit).
 */
const PRIMARY = [
  { href: "/dashboard", label: "Studio", icon: "LayoutGrid" },
  { href: "/calendrier", label: "Calendrier", icon: "Calendar" },
  { href: "/live", label: "Coulisses", icon: "Clapperboard" },
  { href: "/settings", label: "Connexions", icon: "Plug" },
] as const;

const MORE = [
  { href: "/", label: "Accueil", icon: "House" },
  { href: "/bases", label: "Les bases", icon: "BookOpen" },
  { href: "/install", label: "Installer", icon: "Download" },
  { href: "/vps", label: "Héberger", icon: "Server" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/dashboard" && pathname.startsWith("/agents/")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileTabBar() {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const moreActive = MORE.some((m) => isActive(pathname, m.href));

  // La feuille se referme à la navigation, sur Échap et au toucher extérieur.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        moreRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!sheetRef.current?.contains(t) && !moreRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    sheetRef.current?.querySelector<HTMLElement>("a")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <>
      <div
        ref={sheetRef}
        id="tabbar-more"
        className={`tabbar-sheet ${open ? "is-open" : ""}`}
        aria-hidden={!open}
        inert={!open}
      >
        {MORE.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="tabbar-sheet-item"
            aria-current={isActive(pathname, m.href) ? "page" : undefined}
          >
            <Icon name={m.icon} size={18} aria-hidden />
            {m.label}
          </Link>
        ))}
      </div>

      <nav className="tabbar" aria-label="Navigation principale">
        {PRIMARY.map((t) => {
          const active = isActive(pathname, t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`tabbar-item ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon name={t.icon} size={21} strokeWidth={active ? 2.3 : 1.9} aria-hidden />
              <span>{t.label}</span>
            </Link>
          );
        })}
        <button
          ref={moreRef}
          type="button"
          className={`tabbar-item ${open || moreActive ? "active" : ""}`}
          aria-expanded={open}
          aria-controls="tabbar-more"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="MoreHorizontal" size={21} aria-hidden />
          <span>Plus</span>
        </button>
      </nav>
    </>
  );
}
