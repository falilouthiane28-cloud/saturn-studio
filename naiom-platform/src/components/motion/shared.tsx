"use client";

/**
 * Pièces communes aux onglets Motion et Templates du studio de Fatou (types côté client :
 * ne jamais importer lib/instagram ici, ces modules utilisent node:fs).
 */
import { cn } from "@/lib/utils";

export type TypeScene = "HOOK" | "CONTEXT" | "TENSION" | "SOLUTION" | "PROOF" | "UI" | "CTA" | "LOGO";
export type Ton = "clair" | "sombre" | "marque";
export interface TemplateVideo { id: string; name: string; description: string; duree: number; scenes: { type: TypeScene; secondes: number }[]; style: string; builtin?: boolean }

export const LIBELLE_SCENE: Record<TypeScene, string> = {
  HOOK: "Accroche", CONTEXT: "Contexte", TENSION: "Tension", SOLUTION: "Solution", PROOF: "Preuve", UI: "Interface", CTA: "Appel à l'action", LOGO: "Logo",
};
export const NOM_STYLE: Record<string, string> = {
  "clean-explainer": "Clean explainer", "lancement-saas": "Lancement SaaS", "produit-3d": "Produit 3D sombre", "degrade-doux": "Dégradé doux",
};

/** Ton de chaque scène par style : même table que lib/instagram/motion.ts (STYLES_INTEGRES.prompts.tons). */
const TONS: Record<string, Partial<Record<TypeScene, Ton>>> = {
  "clean-explainer": { TENSION: "sombre", CTA: "sombre", LOGO: "sombre" },
  "lancement-saas": { HOOK: "sombre", TENSION: "sombre", CTA: "marque", LOGO: "marque" },
  "produit-3d": { HOOK: "sombre", CONTEXT: "sombre", TENSION: "sombre", SOLUTION: "clair", PROOF: "clair", UI: "sombre", CTA: "marque", LOGO: "marque" },
  "degrade-doux": { UI: "sombre", CTA: "marque", LOGO: "marque" },
};
export function tonDe(type: TypeScene, style: string): Ton {
  return TONS[style]?.[type] ?? (type === "TENSION" || type === "CTA" || type === "LOGO" ? "sombre" : "clair");
}
export const CLASSE_TON: Record<Ton, string> = {
  clair: "bg-white text-[#1A1A1A]",
  sombre: "bg-[#1A1A1A] text-white",
  marque: "bg-[#7C3AED] text-white",
};

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="block text-[11px] font-black uppercase tracking-[0.14em] text-[var(--color-muted)]">{children}</label>;
}

/** Texte à l'écran avec son mot accentué (*mot*) dans la couleur de marque. */
export function TitreAccent({ texte, ton }: { texte: string; ton: Ton }) {
  return (
    <>
      {texte.split(/(\*[^*]+\*)/).filter(Boolean).map((m, i) =>
        m.startsWith("*") && m.endsWith("*")
          ? <span key={i} className={ton === "marque" ? "text-[#FFE5A0]" : ton === "sombre" ? "text-[#B79CF7]" : "text-[#7C3AED]"}>{m.slice(1, -1)}</span>
          : <span key={i}>{m}</span>)}
    </>
  );
}

/** Bande de storyboard : une case par scène, largeur proportionnelle à sa durée, couleur selon le ton du style. */
export function Strip({ scenes, style, className }: { scenes: { type: TypeScene; secondes: number }[]; style: string; className?: string }) {
  const total = scenes.reduce((a, s) => a + s.secondes, 0) || 1;
  return (
    <div className={cn("flex h-7 overflow-hidden rounded-md border border-[var(--color-line)]", className)} role="img"
      aria-label={`Storyboard : ${scenes.map((s) => `${LIBELLE_SCENE[s.type]} ${s.secondes} s`).join(", ")}`}>
      {scenes.map((s, i) => (
        <div key={i} style={{ width: `${(s.secondes / total) * 100}%` }}
          className={cn("flex items-center justify-center border-r border-[var(--color-line)] text-[9px] font-black tracking-wide last:border-r-0", CLASSE_TON[tonDe(s.type, style)])}>
          {s.secondes >= 3 ? s.type : ""}
        </div>
      ))}
    </div>
  );
}

export function Legende() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-muted)]">
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-[var(--color-line)] bg-white" /> clair</span>
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-[#1A1A1A]" /> sombre</span>
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-[#7C3AED]" /> couleur de marque</span>
    </div>
  );
}
