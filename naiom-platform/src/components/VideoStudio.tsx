"use client";

/**
 * Studio vidéo de Fatou : envoi des rushs, réglages du montage, suivi du poste de montage
 * (PC de Fallou, Remotion), lecture et téléchargement des variantes, avis et itérations.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { cn } from "@/lib/utils";

type Style = "rapide" | "informatif" | "suspense" | "humour";
type Fmt = "9:16" | "4:5" | "1:1" | "16:9";
interface Output { file: string; thumb?: string; format: Fmt; variant: string; label: string; seconds: number }
interface Job {
  id: string; createdAt: string; status: "uploading" | "queued" | "rendering" | "done" | "failed";
  title: string; cta: string; style: Style; formats: Fmt[]; duration: number; variants: number;
  clips: { name: string; size: number }[]; outputs?: Output[]; error?: string; guidance?: string; parentId?: string;
  feedback?: { rating: number; note: string; variant?: string; at: string }[];
  plan?: { notes?: string; hook?: string };
}

const STYLES: { key: Style; label: string; hint: string; icon: string }[] = [
  { key: "rapide", label: "Rapide", hint: "Coupes nerveuses, zooms, mots qui claquent", icon: "Zap" },
  { key: "informatif", label: "Informatif", hint: "Fondus, bandeaux clairs, rythme posé", icon: "BookOpen" },
  { key: "suspense", label: "Suspense", hint: "Fondus au noir, machine à écrire, tension", icon: "Eye" },
  { key: "humour", label: "Humour", hint: "Whips, textes qui rebondissent, Orbi qui surgit", icon: "Smile" },
];
const FORMATS: { key: Fmt; label: string }[] = [
  { key: "9:16", label: "9:16 · TikTok / Reels / Shorts" },
  { key: "4:5", label: "4:5 · Feed Instagram / LinkedIn" },
  { key: "1:1", label: "1:1 · Carré" },
  { key: "16:9", label: "16:9 · YouTube" },
];
const DURATIONS = [0, 15, 30, 45, 60, 90];
const ASSETS: { key: "intro" | "titles" | "logo" | "orbi" | "endCard"; label: string }[] = [
  { key: "intro", label: "Accroche d'ouverture" },
  { key: "titles", label: "Textes animés" },
  { key: "logo", label: "Logo Saturn" },
  { key: "orbi", label: "Orbi (mascotte)" },
  { key: "endCard", label: "Écran de fin + CTA" },
];
const STATUS: Record<Job["status"], string> = {
  uploading: "Envoi des rushs…", queued: "En attente du poste de montage", rendering: "Montage en cours sur le PC", done: "Prêt", failed: "Échec",
};

/** Envoi d'un fichier avec progression (fetch n'expose pas la progression d'envoi). */
function upload(jobId: string, file: File, onProgress: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", `/api/video/upload?job=${encodeURIComponent(jobId)}&name=${encodeURIComponent(file.name)}`);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => (x.status < 300 ? resolve() : reject(new Error((() => { try { return JSON.parse(x.responseText).error; } catch { return `Envoi impossible (${x.status})`; } })())));
    x.onerror = () => reject(new Error("Connexion interrompue pendant l'envoi."));
    x.send(file);
  });
}

export function VideoStudio() {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [cta, setCta] = useState("");
  const [style, setStyle] = useState<Style>("rapide");
  const [formats, setFormats] = useState<Fmt[]>(["9:16"]);
  const [duration, setDuration] = useState(0);
  const [variants, setVariants] = useState(3);
  const [assets, setAssets] = useState({ intro: true, titles: true, logo: true, orbi: true, endCard: true });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [online, setOnline] = useState(false);
  const [sending, setSending] = useState<{ name: string; p: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const known = useRef<Record<string, Job["status"]>>({});

  const reload = useCallback(async () => {
    try {
      const j = await (await fetch("/api/video/jobs", { cache: "no-store" })).json();
      const list: Job[] = j.jobs ?? [];
      // Notification navigateur quand un montage devient prêt.
      for (const job of list) {
        const before = known.current[job.id];
        if (before && before !== "done" && job.status === "done" && typeof Notification !== "undefined" && Notification.permission === "granted")
          new Notification("Nouveau montage prêt", { body: job.title || job.id });
        known.current[job.id] = job.status;
      }
      setJobs(list);
      setOnline(!!j.worker?.online);
    } catch { /* réseau */ }
  }, []);
  useEffect(() => {
    void reload();
    const t = setInterval(reload, 8000);
    return () => clearInterval(t);
  }, [reload]);

  async function send() {
    if (!files.length) return;
    setErr(null);
    if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
    try {
      const r = await fetch("/api/video/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, cta, style, formats, duration, variants, assets }) });
      const { job } = await r.json();
      if (!r.ok || !job) throw new Error("Création du montage impossible");
      for (const f of files) {
        setSending({ name: f.name, p: 0 });
        await upload(job.id, f, (p) => setSending({ name: f.name, p }));
      }
      const s = await fetch(`/api/video/jobs/${job.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit" }) });
      if (!s.ok) throw new Error((await s.json()).error ?? "Envoi au montage impossible");
      setFiles([]);
      await reload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erreur"); } finally { setSending(null); }
  }

  const toggleFmt = (f: Fmt) => setFormats((cur) => (cur.includes(f) ? (cur.length > 1 ? cur.filter((x) => x !== f) : cur) : [...cur, f]));
  const renders = variants * formats.length;

  return (
    <div className="grid gap-5 md:grid-cols-[360px_1fr]">
      {/* RÉGLAGES */}
      <div className="space-y-4">
        <div className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-semibold", online ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-amber-300 bg-amber-50 text-amber-700")}>
          <span className={cn("h-2 w-2 rounded-full", online ? "bg-emerald-500" : "bg-amber-500")} />
          {online ? "Poste de montage en ligne (PC de Fallou)" : "Poste de montage hors ligne — les montages attendront qu'il démarre"}
        </div>

        <div>
          <Label>Rushs vidéo</Label>
          <label className="mt-1.5 flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--color-line)] p-4 text-center text-[12px] text-[var(--color-muted)] hover:bg-white/60">
            <Icon name="Upload" size={18} />
            {files.length ? `${files.length} fichier(s) · ${(files.reduce((a, f) => a + f.size, 0) / 1e6).toFixed(0)} Mo` : "Choisis tes clips (mp4, mov…) — ta vidéo avec ta voix"}
            <input type="file" accept="video/*" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </label>
          {files.length > 0 && <ul className="mt-1 space-y-0.5 text-[11px] text-[var(--color-muted)]">{files.map((f) => <li key={f.name} className="truncate">• {f.name}</li>)}</ul>}
        </div>

        <div>
          <Label>Sujet / accroche (optionnel)</Label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. 3 outils IA qui m'ont fait gagner 10h" className="cinput mt-1.5" />
          <input value={cta} onChange={(e) => setCta(e.target.value)} placeholder="Appel à l'action (ex. Écris ORBI en DM)" className="cinput mt-1.5" />
        </div>

        <div>
          <Label>Style de montage</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {STYLES.map((s) => (
              <button key={s.key} onClick={() => setStyle(s.key)}
                className={cn("rounded-xl border-2 p-2.5 text-left transition", style === s.key ? "border-[var(--color-primary)] bg-white" : "border-[var(--color-line)] hover:bg-white/60")}>
                <div className="flex items-center gap-1.5 text-[12px] font-black text-[var(--color-ink)]"><Icon name={s.icon} size={13} /> {s.label}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-[var(--color-muted)]">{s.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Formats</Label>
          <div className="mt-1.5 space-y-1">
            {FORMATS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-[12px] text-[var(--color-ink)]">
                <input type="checkbox" checked={formats.includes(f.key)} onChange={() => toggleFmt(f.key)} /> {f.label}
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Durée</Label>
            <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="cinput mt-1.5">
              {DURATIONS.map((d) => <option key={d} value={d}>{d ? `${d} s` : "Automatique"}</option>)}
            </select>
          </div>
          <div>
            <Label>Variantes</Label>
            <select value={variants} onChange={(e) => setVariants(Number(e.target.value))} className="cinput mt-1.5">
              {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div>
          <Label>Éléments graphiques</Label>
          <div className="mt-1.5 grid grid-cols-2 gap-1">
            {ASSETS.map((a) => (
              <label key={a.key} className="flex items-center gap-2 text-[12px] text-[var(--color-ink)]">
                <input type="checkbox" checked={assets[a.key]} onChange={(e) => setAssets({ ...assets, [a.key]: e.target.checked })} /> {a.label}
              </label>
            ))}
          </div>
        </div>

        <button onClick={send} disabled={!files.length || !!sending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-3 text-[13px] font-bold text-white transition hover:opacity-90 disabled:opacity-40">
          <Icon name={sending ? "Loader" : "Clapperboard"} size={15} className={sending ? "animate-spin" : ""} />
          {sending ? `Envoi de ${sending.name}… ${Math.round(sending.p * 100)} %` : `Envoyer au montage (${renders} vidéo${renders > 1 ? "s" : ""})`}
        </button>
        {err && <div className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-[12px] text-red-600">{err}</div>}
        <p className="text-[10px] text-[var(--color-muted)]">Fatou analyse tes rushs (plans, passages parlés, images clés), choisit le découpage sans couper tes phrases, puis le PC monte les variantes avec Remotion.</p>
      </div>

      {/* MONTAGES */}
      <div className="space-y-3">
        {!jobs.length && <div className="althea-card p-6 text-center text-[13px] text-[var(--color-muted)]">Aucun montage pour l&apos;instant. Envoie tes premiers rushs 🎬</div>}
        {jobs.map((j) => <JobCard key={j.id} job={j} onChange={reload} />)}
      </div>
      <style jsx>{`.cinput{width:100%;border:1px solid var(--color-line);border-radius:10px;padding:9px 11px;font-size:13px;background:var(--color-bg);color:var(--color-ink)}`}</style>
    </div>
  );
}

function JobCard({ job, onChange }: { job: Job; onChange: () => void }) {
  const [note, setNote] = useState("");
  const [rating, setRating] = useState(0);
  const [busy, setBusy] = useState(false);
  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/video/jobs/${job.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) alert((await r.json()).error ?? "Erreur");
      else { setNote(""); setRating(0); onChange(); }
    } finally { setBusy(false); }
  };
  const del = async () => { if (confirm("Supprimer ce montage et ses vidéos ?")) { await fetch(`/api/video/jobs/${job.id}`, { method: "DELETE" }); onChange(); } };
  const file = (name: string, dl = false) => `/api/video/file/${job.id}/${encodeURIComponent(name)}${dl ? "?dl=1" : ""}`;
  const pending = job.status !== "done" && job.status !== "failed";

  return (
    <div className="althea-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[14px] font-black text-[var(--color-ink)]">{job.title || "Montage sans titre"}</div>
          <div className="text-[11px] text-[var(--color-muted)]">
            {new Date(job.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })} · {job.style} · {job.formats.join(", ")} · {job.clips.length} rush(s)
            {job.parentId && " · itération"}
          </div>
          {job.guidance && <div className="mt-1 text-[11px] italic text-[var(--color-muted)]">Retour appliqué : « {job.guidance} »</div>}
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
            job.status === "done" ? "bg-emerald-100 text-emerald-700" : job.status === "failed" ? "bg-red-100 text-red-600" : "bg-violet-100 text-violet-700")}>
            {pending && <Icon name="Loader" size={10} className="mr-1 inline animate-spin" />}{STATUS[job.status]}
          </span>
          <button onClick={del} aria-label="Supprimer" className="text-[var(--color-muted)] hover:text-rose-500"><Icon name="Trash2" size={14} /></button>
        </div>
      </div>
      {job.error && <div className="mt-2 rounded-lg bg-red-50 p-2 text-[11px] text-red-600">{job.error}</div>}
      {job.plan?.notes && <div className="mt-2 text-[11px] text-[var(--color-muted)]"><b className="text-[var(--color-ink)]">Parti pris de Fatou :</b> {job.plan.notes}</div>}

      {!!job.outputs?.length && (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          {job.outputs.map((o) => (
            <div key={o.file} className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-black">
              <video src={file(o.file)} poster={o.thumb ? file(o.thumb) : undefined} controls preload="none" className="w-full" style={{ aspectRatio: o.format.replace(":", "/") }} />
              <div className="flex items-center justify-between bg-[var(--color-bg)] px-2 py-1.5">
                <div className="text-[11px]"><b className="text-[var(--color-ink)]">{o.label}</b> <span className="text-[var(--color-muted)]">· {o.format} · {o.seconds} s</span></div>
                <a href={file(o.file, true)} className="flex items-center gap-1 text-[11px] font-bold text-[var(--color-primary)]"><Icon name="Download" size={12} /> MP4</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {job.status === "done" && (
        <div className="mt-3 space-y-2 rounded-xl border border-[var(--color-line)] p-3">
          <div className="flex items-center gap-1 text-[12px] font-bold text-[var(--color-ink)]">
            Ton avis :
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className={cn("text-[16px]", n <= rating ? "text-amber-400" : "text-neutral-300")} aria-label={`${n} étoiles`}>★</button>
            ))}
          </div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ex. La variante « Accroche d'abord » est top, mais coupe l'intro et mets plus de textes."
            className="w-full resize-none rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] p-2 text-[12px]" />
          <div className="flex gap-2">
            <button disabled={busy || !rating} onClick={() => act({ action: "feedback", rating, note })} className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[12px] font-bold disabled:opacity-40">Enregistrer l&apos;avis</button>
            <button disabled={busy || !note.trim()} onClick={() => act({ action: "iterate", note })} className="flex items-center gap-1 rounded-lg bg-[var(--color-ink)] px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-40">
              <Icon name="RefreshCw" size={12} /> Nouvelle itération avec ce retour
            </button>
          </div>
          {!!job.feedback?.length && <div className="text-[11px] text-[var(--color-muted)]">{job.feedback.map((f) => `${"★".repeat(f.rating)} ${f.note}`).join(" · ")}</div>}
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] font-black uppercase tracking-[0.08em] text-[var(--color-muted)]">{children}</div>;
}
