"use client";

/**
 * Pièces communes aux onglets Motion et Templates du studio de Fatou (types côté client :
 * ne jamais importer lib/instagram ici, ces modules utilisent node:fs).
 */
import { cn } from "@/lib/utils";

export type TypeScene = "HOOK" | "CONTEXT" | "TENSION" | "SOLUTION" | "PROOF" | "CTA";
export interface TemplateVideo { id: string; name: string; description: string; duree: number; scenes: { type: TypeScene; secondes: number }[]; style: string; builtin?: boolean }

export const LIBELLE_SCENE: Record<TypeScene, string> = {
  HOOK: "Accroche", CONTEXT: "Contexte", TENSION: "Tension", SOLUTION: "Solution", PROOF: "Preuve", CTA: "Appel à l'action",
};
export const FOND_NOIR = new Set<TypeScene>(["TENSION", "CTA"]);

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="block text-[11px] font-black uppercase tracking-[0.14em] text-[var(--color-muted)]">{children}</label>;
}

/** Bande de storyboard : une case par scène, largeur proportionnelle à sa durée, fond blanc ou noir. */
export function Strip({ scenes, className }: { scenes: { type: TypeScene; secondes: number }[]; className?: string }) {
  const total = scenes.reduce((a, s) => a + s.secondes, 0) || 1;
  return (
    <div className={cn("flex h-7 overflow-hidden rounded-md border border-[var(--color-line)]", className)} role="img"
      aria-label={`Storyboard : ${scenes.map((s) => `${LIBELLE_SCENE[s.type]} ${s.secondes} s`).join(", ")}`}>
      {scenes.map((s, i) => (
        <div key={i} style={{ width: `${(s.secondes / total) * 100}%` }}
          className={cn("flex items-center justify-center border-r border-[var(--color-line)] text-[9px] font-black tracking-wide last:border-r-0",
            FOND_NOIR.has(s.type) ? "bg-[#1A1A1A] text-white" : "bg-white text-[#1A1A1A]")}>
          {s.secondes >= 3 ? s.type : ""}
        </div>
      ))}
    </div>
  );
}

export function Legende() {
  return (
    <div className="flex items-center gap-3 text-[11px] text-[var(--color-muted)]">
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm border border-[var(--color-line)] bg-white" /> fond blanc</span>
      <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm bg-[#1A1A1A]" /> fond noir</span>
    </div>
  );
}
