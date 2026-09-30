"use client";

/**
 * Onglet Templates du studio de Fatou : galerie des structures de vidéos motion design
 * (intégrées + perso), « Utiliser » pour préremplir l'onglet Motion, création par l'IA.
 */
import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Plus, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label, Legende, Strip, type TemplateVideo } from "./shared";

export function TemplatesStudio({ onUse, actif }: { onUse: (id: string) => void; actif: string }) {
  const [templates, setTemplates] = useState<TemplateVideo[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [description, setDescription] = useState("");
  const [creation, setCreation] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { const j = await (await fetch("/api/motion/templates", { cache: "no-store" })).json(); setTemplates(j.templates ?? []); }
    catch { setErr("Impossible de charger les templates."); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  async function creer() {
    setErr(null); setCreation(true);
    try {
      const r = await fetch("/api/motion/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Création impossible");
      setDescription(""); setOuvert(false); await reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); } finally { setCreation(false); }
  }

  async function supprimer(t: TemplateVideo) {
    if (!confirm(`Supprimer le template « ${t.name} » ?`)) return;
    const r = await fetch(`/api/motion/templates?id=${encodeURIComponent(t.id)}`, { method: "DELETE" });
    if (!r.ok) setErr((await r.json()).error ?? "Suppression impossible"); else await reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] text-[var(--color-muted)]">
          Chaque template fixe la durée et l&apos;enchaînement des scènes. Choisis-en un, puis écris ton idée dans l&apos;onglet Motion.
        </p>
        <button onClick={() => setOuvert((v) => !v)} aria-expanded={ouvert}
          className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--color-ink)] px-3.5 text-[13px] font-bold text-white transition hover:opacity-90">
          <Plus size={15} aria-hidden /> Nouveau template
        </button>
      </div>

      {ouvert && (
        <div className="space-y-2 rounded-2xl border border-[var(--color-line)] bg-white/70 p-4">
          <Label htmlFor="tpl-desc">Décris le template</Label>
          <textarea id="tpl-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000}
            placeholder="Ex. une vidéo de 15 s qui démonte une idée reçue : l'idée reçue, pourquoi c'est faux, la vraie réponse, l'appel à l'action."
            className="cinput" />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-[var(--color-muted)]">Fatou conçoit la structure ; rien n&apos;est généré chez Higgsfield.</span>
            <button onClick={creer} disabled={creation || !description.trim()}
              className="flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-3.5 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-50">
              {creation ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Sparkles size={15} aria-hidden />}
              {creation ? "Fatou conçoit le template…" : "Créer avec l'IA"}
            </button>
          </div>
        </div>
      )}

      {err && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">{err}</p>}

      <Legende />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <article key={t.id} className={cn("flex flex-col gap-3 rounded-2xl border bg-white/70 p-4 transition",
            actif === t.id ? "border-[var(--color-primary)] ring-2 ring-[var(--color-primary)]/20" : "border-[var(--color-line)]")}>
            <Strip scenes={t.scenes} />
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-black text-[var(--color-ink)]">{t.name}</h3>
                <p className="text-[11px] font-semibold text-[var(--color-muted)]">{t.duree} s · {t.scenes.length} scènes{t.builtin ? "" : " · perso"}</p>
              </div>
              {!t.builtin && (
                <button onClick={() => supprimer(t)} aria-label={`Supprimer le template ${t.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={15} aria-hidden />
                </button>
              )}
            </div>
            <p className="flex-1 text-[12px] leading-relaxed text-[var(--color-ink)]/80">{t.description}</p>
            <button onClick={() => onUse(t.id)}
              className="min-h-[40px] rounded-xl border border-[var(--color-line)] text-[13px] font-bold text-[var(--color-ink)] transition hover:bg-[var(--color-ink)] hover:text-white">
              {actif === t.id ? "Sélectionné · ouvrir Motion" : "Utiliser"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
