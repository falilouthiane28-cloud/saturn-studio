"use client";

/**
 * Onglet Motion du studio de Fatou : idée → plan (gratuit) → génération Higgsfield après
 * confirmation → montage automatique → vidéo finale. La génération avance tant que l'onglet
 * est ouvert (interrogation du serveur toutes les 5 s) et reprend à la visite suivante.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Clapperboard, Download, LoaderCircle, Mic, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLASSE_TON, LIBELLE_SCENE, Label, NOM_STYLE, Strip, TitreAccent, tonDe, type TemplateVideo, type Ton, type TypeScene } from "./shared";

type Format = "9:16" | "16:9";
interface ScenePlan { n: number; type: TypeScene; debut: number; fin: number; texte_ecran: string; narration: string; ton?: Ton }
interface Etape { statut: "attente" | "image" | "animation" | "prete" | "echec"; image_url?: string; video_url?: string; erreur?: string }
interface Job {
  id: string; createdAt: string; statut: "plan" | "generation" | "montage" | "pret" | "echec"; final_url?: string; sans_voix_url?: string; narration?: string; erreur?: string;
  etapes: Etape[];
  plan: {
    idee: string; sujet: string; duree: number; template: { id: string; name: string }; cta: string; points: string[]; style?: string; format?: Format;
    accroches: { formula_id: number; texte: string; score: number }[];
    scenes: ScenePlan[];
    narration: { texte: string; human_score: number; ok: boolean; mots: number; cible: number };
    chiffres_a_remplir: string[];
  };
}

const STATUT: Record<Job["statut"], { label: string; cls: string }> = {
  plan: { label: "Plan prêt", cls: "bg-slate-100 text-slate-700" },
  generation: { label: "Génération", cls: "bg-amber-50 text-amber-700" },
  montage: { label: "Montage", cls: "bg-amber-50 text-amber-700" },
  pret: { label: "Vidéo prête", cls: "bg-emerald-50 text-emerald-700" },
  echec: { label: "Échec", cls: "bg-red-50 text-red-700" },
};
const ETAPE: Record<Etape["statut"], string> = { attente: "En attente", image: "Image en cours", animation: "Animation en cours", prete: "Prête", echec: "Échec" };
const tc = (s: number) => `0:${String(Math.round(s)).padStart(2, "0")}`;

export function MotionStudio({ templateId, onTemplate }: { templateId: string; onTemplate: (id: string) => void }) {
  const [templates, setTemplates] = useState<TemplateVideo[]>([]);
  const [idee, setIdee] = useState("");
  const [format, setFormat] = useState<Format>("9:16");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [preparation, setPreparation] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [mixage, setMixage] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const enCours = useRef(false);

  const reload = useCallback(async () => {
    try {
      const [t, j] = await Promise.all([
        fetch("/api/motion/templates", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/motion/jobs", { cache: "no-store" }).then((r) => r.json()),
      ]);
      setTemplates(t.templates ?? []);
      setJobs(j.jobs ?? []);
    } catch { setErr("Impossible de charger le studio Motion."); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  // Fait avancer les vidéos en cours (images → animations → montage).
  useEffect(() => {
    const t = setInterval(async () => {
      if (enCours.current) return;
      const actifs = jobs.filter((j) => j.statut === "generation" || j.statut === "montage");
      if (!actifs.length) return;
      enCours.current = true;
      try {
        for (const a of actifs) {
          const r = await fetch(`/api/motion/jobs/${a.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "avancer" }) });
          const { job } = await r.json();
          if (job) setJobs((cur) => cur.map((x) => (x.id === job.id ? job : x)));
        }
      } catch { /* réseau : on réessaie au prochain tour */ } finally { enCours.current = false; }
    }, 5000);
    return () => clearInterval(t);
  }, [jobs]);

  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const sel = jobs.find((j) => j.id === selId) ?? null;

  async function preparer() {
    setErr(null); setPreparation(true); setConfirmer(false);
    try {
      const r = await fetch("/api/motion/plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idee, templateId: template?.id, format }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Plan impossible");
      setJobs((cur) => [j.job, ...cur]); setSelId(j.job.id);
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); } finally { setPreparation(false); }
  }

  async function lancer(job: Job) {
    setErr(null); setConfirmer(false);
    const r = await fetch(`/api/motion/jobs/${job.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "lancer", confirme: true }) });
    const j = await r.json();
    if (!r.ok) setErr(j.error ?? "Lancement impossible");
    if (j.job) setJobs((cur) => cur.map((x) => (x.id === j.job.id ? j.job : x)));
  }

  async function envoyerNarration(job: Job, fichier: File | undefined) {
    if (!fichier) return;
    setErr(null); setMixage(true);
    try {
      const fd = new FormData(); fd.append("audio", fichier);
      const r = await fetch(`/api/motion/jobs/${job.id}/narration`, { method: "POST", body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Mixage impossible");
      setJobs((cur) => cur.map((x) => (x.id === j.job.id ? j.job : x)));
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); } finally { setMixage(false); }
  }

  async function supprimer(job: Job) {
    if (!confirm("Supprimer cette vidéo de la liste ?")) return;
    await fetch(`/api/motion/jobs/${job.id}`, { method: "DELETE" });
    setJobs((cur) => cur.filter((x) => x.id !== job.id)); if (selId === job.id) setSelId(null);
  }

  return (
    <div className="grid gap-5 md:grid-cols-[340px_1fr]">
      {/* COLONNE GAUCHE : idée, template, historique */}
      <div className="space-y-4">
        <div>
          <Label htmlFor="motion-idee">Ton idée de vidéo</Label>
          <textarea id="motion-idee" value={idee} onChange={(e) => setIdee(e.target.value)} rows={4} maxLength={2000}
            placeholder="Ex. pourquoi Saturn remplace 3 prestataires : un seul studio pour la marque, le site et l'app."
            className="cinput mt-1.5" />
        </div>

        <div>
          <Label>Template</Label>
          <div className="mt-1.5 space-y-2" role="radiogroup" aria-label="Template de la vidéo">
            {templates.map((t) => (
              <button key={t.id} role="radio" aria-checked={template?.id === t.id} onClick={() => onTemplate(t.id)}
                className={cn("w-full space-y-1.5 rounded-xl border-2 p-2.5 text-left transition",
                  template?.id === t.id ? "border-[var(--color-primary)] bg-white" : "border-[var(--color-line)] hover:bg-white/60")}>
                <div className="flex items-center justify-between text-[12px] font-black text-[var(--color-ink)]">
                  <span>{t.name}</span><span className="text-[11px] font-semibold text-[var(--color-muted)]">{t.duree} s</span>
                </div>
                <Strip scenes={t.scenes} style={t.style} className="h-5" />
                <span className="block text-[10px] text-[var(--color-muted)]">{NOM_STYLE[t.style] ?? t.style}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Format</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Format de la vidéo">
            {([["9:16", "Vertical 9:16", "Reels, TikTok, Shorts"], ["16:9", "Paysage 16:9", "LinkedIn, X, site"]] as const).map(([f, l, h]) => (
              <button key={f} role="radio" aria-checked={format === f} onClick={() => setFormat(f)}
                className={cn("rounded-xl border-2 p-2.5 text-left transition", format === f ? "border-[var(--color-primary)] bg-white" : "border-[var(--color-line)] hover:bg-white/60")}>
                <span className="block text-[12px] font-black text-[var(--color-ink)]">{l}</span>
                <span className="block text-[10px] text-[var(--color-muted)]">{h}</span>
              </button>
            ))}
          </div>
        </div>

        <button onClick={preparer} disabled={preparation || !idee.trim() || !template}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-ink)] text-[14px] font-bold text-white transition hover:opacity-90 disabled:opacity-50">
          {preparation ? <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Sparkles size={16} aria-hidden />}
          {preparation ? "Fatou écrit le plan…" : "Préparer le plan"}
        </button>
        <p className="text-[11px] text-[var(--color-muted)]">Le plan est gratuit : aucun crédit Higgsfield n&apos;est dépensé avant ta confirmation.</p>
        {err && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">{err}</p>}

        {jobs.length > 0 && (
          <div>
            <Label>Mes vidéos</Label>
            <ul className="mt-1.5 space-y-1.5">
              {jobs.map((j) => (
                <li key={j.id}>
                  <button onClick={() => { setSelId(j.id); setConfirmer(false); }}
                    className={cn("flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-left transition",
                      selId === j.id ? "border-[var(--color-ink)] bg-white" : "border-[var(--color-line)] hover:bg-white/60")}>
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-bold text-[var(--color-ink)]">{j.plan.sujet || j.plan.idee}</span>
                      <span className="text-[10px] text-[var(--color-muted)]">{j.plan.template.name} · {j.plan.duree} s · {new Date(j.createdAt).toLocaleDateString("fr-FR")}</span>
                    </span>
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold", STATUT[j.statut].cls)}>{STATUT[j.statut].label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* COLONNE DROITE : la vidéo sélectionnée */}
      {!sel ? (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--color-line)] p-8 text-center">
          <Clapperboard size={28} className="text-[var(--color-muted)]" aria-hidden />
          <p className="text-[14px] font-bold text-[var(--color-ink)]">Décris ton idée, choisis un template</p>
          <p className="max-w-sm text-[12px] text-[var(--color-muted)]">Fatou écrit les accroches, le texte de chaque scène et la narration. Tu relis, puis tu lances la génération.</p>
        </div>
      ) : (
        <section className="space-y-5 rounded-2xl border border-[var(--color-line)] bg-white/70 p-5" aria-live="polite">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[18px] font-black tracking-tight text-[var(--color-ink)]">{sel.plan.sujet}</h3>
              <p className="text-[12px] text-[var(--color-muted)]">{sel.plan.template.name} · {sel.plan.duree} s · {sel.plan.scenes.length} scènes · {NOM_STYLE[sel.plan.style ?? "clean-explainer"] ?? sel.plan.style} · {sel.plan.format ?? "9:16"}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", STATUT[sel.statut].cls)}>{STATUT[sel.statut].label}</span>
              <button onClick={() => supprimer(sel)} aria-label="Supprimer cette vidéo"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-muted)] transition hover:bg-red-50 hover:text-red-600"><Trash2 size={15} aria-hidden /></button>
            </div>
          </header>

          {sel.statut === "pret" && sel.final_url && (
            <div className="flex flex-wrap items-start gap-4 rounded-xl bg-[#1A1A1A] p-4">
              <video src={sel.final_url} controls playsInline className={cn("rounded-lg bg-black", sel.plan.format === "16:9" ? "aspect-video w-[360px] max-w-full" : "aspect-[9/16] w-[200px]")} />
              <div className="space-y-2 text-white">
                <p className="text-[14px] font-black">{sel.narration ? "Ta vidéo est montée, avec ta voix." : "Ta vidéo est montée."}</p>
                <p className="max-w-xs text-[12px] text-white/70">
                  Titres animés et sound design inclus (whoosh, pops, frappe, riser et impact sur le logo, nappe d&apos;ambiance).
                  {sel.narration ? " La musique baisse sous ta voix." : " Ajoute ta narration : enregistre le texte ci-dessous et envoie le fichier."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <a href={sel.final_url} download className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-white px-3.5 text-[13px] font-bold text-[#1A1A1A]"><Download size={15} aria-hidden /> Télécharger</a>
                  <label className={cn("inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/30 px-3.5 text-[13px] font-bold text-white transition hover:bg-white/10", mixage && "pointer-events-none opacity-60")}>
                    {mixage ? <LoaderCircle size={15} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Mic size={15} aria-hidden />}
                    {mixage ? "Mixage de ta voix…" : sel.narration ? "Remplacer ma narration" : "Ajouter ma narration"}
                    <input type="file" accept="audio/*" className="sr-only" disabled={mixage} onChange={(e) => { void envoyerNarration(sel, e.target.files?.[0]); e.target.value = ""; }} />
                  </label>
                </div>
                {sel.sans_voix_url && <a href={sel.sans_voix_url} download className="block text-[11px] text-white/60 underline">Télécharger la version sans voix</a>}
              </div>
            </div>
          )}

          <div>
            <Label>Accroches (hookscore)</Label>
            <ol className="mt-1.5 space-y-1">
              {sel.plan.accroches.map((a, i) => (
                <li key={i} className="flex items-center gap-2 text-[13px] text-[var(--color-ink)]">
                  <span className={cn("w-10 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[11px] font-black", a.score >= 50 ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{Math.round(a.score)}</span>
                  <span className="text-[11px] text-[var(--color-muted)]">#{a.formula_id}</span>
                  <span className={i === 0 ? "font-bold" : ""}>{a.texte}</span>
                </li>
              ))}
            </ol>
          </div>

          <div>
            <Label>Storyboard</Label>
            <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
              {sel.plan.scenes.map((s, i) => {
                const e = sel.etapes[i];
                const ton = s.ton ?? tonDe(s.type, sel.plan.style ?? "clean-explainer");
                const noir = ton !== "clair";
                const paysage = sel.plan.format === "16:9";
                return (
                  <figure key={s.n} className={cn("shrink-0 space-y-1.5", paysage ? "w-[220px]" : "w-[128px]")}>
                    <div className={cn("relative flex items-center justify-center overflow-hidden rounded-lg border p-2 text-center", paysage ? "aspect-video" : "aspect-[9/16]", CLASSE_TON[ton], noir ? "border-transparent" : "border-[var(--color-line)]")}>
                      {e?.video_url ? <video src={e.video_url} muted loop autoPlay playsInline className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden" />
                        : e?.image_url ? <img src={e.image_url} alt={`Image clé, scène ${s.n}`} className="absolute inset-0 h-full w-full object-cover" />
                        : null}
                      <span className="relative text-[12px] font-black leading-tight drop-shadow-sm"><TitreAccent texte={s.texte_ecran} ton={ton} /></span>
                      <span className={cn("absolute left-1.5 top-1.5 rounded px-1 text-[9px] font-black", noir ? "bg-white/15" : "bg-black/5")}>{s.type}</span>
                      <span className={cn("absolute bottom-1.5 right-1.5 text-[9px] font-semibold", noir ? "text-white/60" : "text-black/40")}>{tc(s.debut)}–{tc(s.fin)}</span>
                    </div>
                    <figcaption className="space-y-0.5">
                      <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--color-muted)]">
                        {e?.statut === "prete" ? <Check size={11} className="text-emerald-600" aria-hidden /> : e?.statut === "echec" ? <TriangleAlert size={11} className="text-red-600" aria-hidden /> : null}
                        {LIBELLE_SCENE[s.type]}{sel.statut !== "plan" && e ? ` · ${ETAPE[e.statut]}` : ""}
                      </span>
                      <span className="block text-[11px] leading-snug text-[var(--color-ink)]/80">{s.narration}</span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-line)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>Narration ({sel.plan.narration.mots} mots, cible {sel.plan.narration.cible})</Label>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", sel.plan.narration.ok ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                ig-human {Math.round(sel.plan.narration.human_score)}/100 {sel.plan.narration.ok ? "· OK" : "· à retravailler"}
              </span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-ink)]">{sel.plan.narration.texte}</p>
            {sel.plan.chiffres_a_remplir.length > 0 && (
              <p className="mt-2 text-[11px] font-semibold text-amber-700">À remplir par toi : {"{{your number}}"} remplace {sel.plan.chiffres_a_remplir.join(", ")} (Fatou n&apos;invente aucun chiffre).</p>
            )}
            <p className="mt-2 text-[11px] text-[var(--color-muted)]">CTA : {sel.plan.cta}</p>
          </div>

          {/* ACTIONS */}
          {(sel.statut === "plan" || sel.statut === "echec") && (
            <div className="space-y-2">
              {sel.statut === "echec" && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">{sel.erreur}</p>}
              {!confirmer ? (
                <button onClick={() => setConfirmer(true)}
                  className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] text-[14px] font-bold text-white transition hover:opacity-90">
                  <Clapperboard size={16} aria-hidden /> {sel.statut === "echec" ? "Relancer les scènes en échec" : `Générer la vidéo · ${sel.plan.scenes.length} images + ${sel.plan.scenes.length} animations`}
                </button>
              ) : (
                <div className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3" role="alertdialog" aria-label="Confirmer la génération">
                  <p className="text-[13px] font-bold text-amber-900">Ça dépense tes crédits de l&apos;API Higgsfield ({sel.plan.scenes.length} images clés puis {sel.plan.scenes.length} animations). On y va ?</p>
                  <div className="flex gap-2">
                    <button onClick={() => lancer(sel)} className="min-h-[40px] flex-1 rounded-xl bg-[var(--color-ink)] text-[13px] font-bold text-white">Oui, générer</button>
                    <button onClick={() => setConfirmer(false)} className="min-h-[40px] flex-1 rounded-xl border border-[var(--color-line)] bg-white text-[13px] font-bold text-[var(--color-ink)]">Annuler</button>
                  </div>
                </div>
              )}
            </div>
          )}
          {(sel.statut === "generation" || sel.statut === "montage") && (
            <div className="space-y-1.5">
              <div className="h-2 overflow-hidden rounded-full bg-[var(--color-line)]" role="progressbar" aria-valuemin={0} aria-valuemax={sel.etapes.length}
                aria-valuenow={sel.etapes.filter((e) => e.statut === "prete").length} aria-label="Progression de la génération">
                <div className="h-full bg-[var(--color-primary)] transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${(sel.etapes.reduce((a, e) => a + (e.statut === "prete" ? 1 : e.statut === "animation" ? 0.5 : 0), 0) / sel.etapes.length) * 100}%` }} />
              </div>
              <p className="flex items-center gap-1.5 text-[12px] text-[var(--color-muted)]">
                <LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden />
                {sel.statut === "montage" ? "Montage de la vidéo finale…" : "Fatou génère les scènes. Garde cet onglet ouvert : la génération avance tant qu'il l'est, et reprend à ta prochaine visite."}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
