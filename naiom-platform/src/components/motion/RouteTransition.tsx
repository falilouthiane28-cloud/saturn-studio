"use client";

import { usePathname } from "next/navigation";

/**
 * Fondu d'entrée à chaque changement de route.
 *
 * La `key` sur le pathname force React à recréer le sous-arbre à chaque
 * navigation, ce qui relance l'animation CSS — sans quoi elle ne jouerait
 * qu'au tout premier rendu.
 *
 * POURQUOI UNIQUEMENT L'OPACITÉ, et pas un glissement :
 * un `transform` sur un conteneur crée un bloc conteneur pour ses descendants
 * `position: fixed`. La barre de navigation est précisément en `fixed` : elle
 * se serait donc décalée pendant toute la durée de l'animation, c'est-à-dire
 * exactement le saut qu'on cherche à supprimer. `opacity` crée un contexte
 * d'empilement mais PAS de bloc conteneur — la nav reste ancrée à la fenêtre.
 */
export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="route-transition">
      {children}
    </div>
  );
}
