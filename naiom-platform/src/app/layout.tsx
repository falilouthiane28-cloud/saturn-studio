import type { Metadata } from "next";
import { Inter, Instrument_Serif, Sacramento, Archivo } from "next/font/google";
import "./globals.css";
import { MotionRoot } from "@/components/motion/MotionRoot";
import { RouteTransition } from "@/components/motion/RouteTransition";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Police display grasse (landing "Bronx" — marquee géant, titres, nav pill).
// Variable font : toutes les graisses 100→900 disponibles.
const archivo = Archivo({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

// Police script/cursive type "Althea" — pour le logo et les accents calligraphiques.
const sacramento = Sacramento({
  variable: "--font-script",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Saturn Studio · Une équipe d'employés IA",
  description: "Mon équipe d'employés IA, sous la main — Saturn Studio.",
};

/**
 * Pose `data-theme` sur <html> avant le premier rendu.
 * Sans ça, une page chargée en thème sombre s'afficherait d'abord en clair
 * le temps que React s'hydrate (flash blanc).
 */
const THEME_INIT = `
(function () {
  try {
    // Clair par défaut : le sombre n'est appliqué que sur choix explicite.
    var dark = localStorage.getItem("saturn-theme") === "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  } catch (e) {
    document.documentElement.dataset.theme = "light";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${inter.variable} ${instrumentSerif.variable} ${sacramento.variable} ${archivo.variable}`}
    >
      <head>
        {/* Anti-flash de thème.
            `next/script` en `beforeInteractive` ne convient pas ici : React le
            rend comme une vraie balise <script> au moment de l'hydratation,
            ce qui déclenche « Encountered a script tag while rendering React
            component » et, pire, ne l'exécute pas côté client.
            Un script inline dans <head> est la forme canonique en App Router :
            il s'exécute avant le premier paint, donc `data-theme` est déjà posé
            quand la page s'affiche. `suppressHydrationWarning` sur <html>
            couvre l'attribut ajouté hors de React. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body>
        <MotionRoot />
        <RouteTransition>{children}</RouteTransition>
      </body>
    </html>
  );
}
