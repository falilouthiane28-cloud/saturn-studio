"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Couche de mouvement GSAP, montée une seule fois dans le layout racine.
 *
 * Elle fait deux choses, toutes deux en délégation d'événements pour ne pas
 * avoir à instrumenter chaque composant :
 *   1. Transition de route : le contenu monte en fondu à chaque changement
 *      de pathname.
 *   2. Retour tactile : enfoncement des boutons au pointerdown.
 *
 * Toute l'animation est un enrichissement. Si GSAP ne se charge pas, ou si
 * l'utilisateur a demandé moins de mouvement, l'interface reste pleinement
 * fonctionnelle et visible — rien n'est masqué en attendant un script.
 */
export function MotionRoot() {
  const pathname = usePathname();
  // Évite de rejouer la transition au tout premier rendu (le CSS s'en charge).
  const firstRender = useRef(true);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    (async () => {
      const { gsap } = await import("gsap");
      if (cancelled) return;

      /* --- 1. Retour tactile sur les boutons --- */
      const pressSelector = ".ds-btn, .ds-icon-btn, [data-press]";

      const onDown = (e: PointerEvent) => {
        const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(pressSelector);
        if (!el) return;
        gsap.to(el, { scale: 0.96, duration: 0.09, ease: "power2.out" });
      };

      const release = (e: PointerEvent) => {
        const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(pressSelector);
        if (!el) return;
        gsap.to(el, { scale: 1, duration: 0.22, ease: "power2.out" });
      };

      document.addEventListener("pointerdown", onDown);
      document.addEventListener("pointerup", release);
      document.addEventListener("pointercancel", release);

      cleanup = () => {
        document.removeEventListener("pointerdown", onDown);
        document.removeEventListener("pointerup", release);
        document.removeEventListener("pointercancel", release);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, []);

  /* --- 2. Transition de route --- */
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let cancelled = false;
    (async () => {
      const { gsap } = await import("gsap");
      if (cancelled) return;
      const target = document.body;
      // `from` (et non `fromTo`) : l'état final est l'état naturel du DOM,
      // donc une interruption laisse toujours la page visible.
      gsap.from(target, { opacity: 0, y: 8, duration: 0.32, ease: "power2.out" });
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
