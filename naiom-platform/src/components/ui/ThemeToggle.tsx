"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";

type Theme = "light" | "dark";

const STORAGE_KEY = "saturn-theme";

/**
 * Bascule clair / sombre.
 *
 * Le thème effectif est porté par l'attribut `data-theme` sur <html>, que
 * le script inline de layout.tsx pose AVANT le premier rendu (pas de flash).
 * Ce composant ne fait que lire l'état courant et l'inverser.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  // Lit l'état réel appliqué au document plutôt qu'une valeur par défaut :
  // évite que le bouton affiche l'inverse du thème pendant l'hydratation.
  useEffect(() => {
    const current = document.documentElement.dataset.theme as Theme | undefined;
    setTheme(current ?? "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    const root = document.documentElement;
    // Fondu de couleurs le temps du basculement uniquement (cf. theme.css).
    root.classList.add("theme-switching");
    root.dataset.theme = next;
    window.setTimeout(() => root.classList.remove("theme-switching"), 320);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Mode privé / stockage bloqué : le thème reste valable pour la session.
    }
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className={className}
      aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
      aria-pressed={isDark}
      title={isDark ? "Thème clair" : "Thème sombre"}
    >
      {/* suppressHydrationWarning : l'icône dépend du thème résolu côté client. */}
      <span suppressHydrationWarning>
        <Icon name={isDark ? "Sun" : "Moon"} size={16} />
      </span>
    </button>
  );
}
