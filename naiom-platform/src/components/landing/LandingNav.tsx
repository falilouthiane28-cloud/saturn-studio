"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SaturnLogo } from "@/components/brand/SaturnLogo";

/**
 * Nav pill centrée façon template "Bronx" : les items suivent le scroll
 * (IntersectionObserver) et l'item actif porte une pill dans l'accent.
 * Les deux derniers items sont des liens de page (Studio / Coulisses).
 */
const SECTIONS = [
  { id: "accueil", label: "Accueil" },
  { id: "apropos", label: "À propos" },
  { id: "equipe", label: "Équipe" },
  { id: "services", label: "Services" },
  { id: "plateforme", label: "Plateforme" },
  { id: "contact", label: "Contact" },
] as const;

export function LandingNav() {
  const [active, setActive] = useState<string>("accueil");
  const navRef = useRef<HTMLElement>(null);

  // Sur mobile la pilule défile : l'item actif est toujours ramené au centre,
  // sinon « Contact » deviendrait actif hors de l'écran.
  useEffect(() => {
    const nav = navRef.current;
    const item = nav?.querySelector<HTMLElement>(".bronx-nav-item.active");
    if (!nav || !item || nav.scrollWidth <= nav.clientWidth) return;
    const left = item.offsetLeft - (nav.clientWidth - item.offsetWidth) / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nav.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
  }, [active]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // On prend la section visible la plus haute dans le viewport.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-35% 0px -55% 0px" }
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 z-50 flex justify-center pt-5 pointer-events-none">
      {/* Cf. AppNav : hors du flux pour ne pas décentrer la pilule. */}
      <a
        href="#accueil"
        aria-label="Saturn Studio — haut de page"
        className="pointer-events-auto absolute left-8 top-1/2 hidden -translate-y-1/2 lg:block"
        style={{ color: "var(--text-1)" }}
      >
        <SaturnLogo variant="full" size={19} />
      </a>

      <nav ref={navRef} aria-label="Sections de la page" className="bronx-nav pointer-events-auto max-w-[94vw] overflow-x-auto no-scrollbar">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={`bronx-nav-item ${active === s.id ? "active" : ""}`}
            aria-current={active === s.id ? "location" : undefined}
          >
            {s.label}
          </a>
        ))}
        <Link href="/dashboard" className="bronx-nav-item">
          Studio
        </Link>
      </nav>
    </header>
  );
}
