import { addJob, FORMATS, listJobs, STYLES, workerLastSeen, type VideoAssets, type VideoFormat, type VideoStyle } from "@/lib/video/store";

export const runtime = "nodejs";

/** GET /api/video/jobs — montages + état du poste de montage (en ligne si vu il y a moins d'une minute). */
export async function GET() {
  const seen = await workerLastSeen();
  return Response.json({ jobs: await listJobs(), worker: { online: !!seen && Date.now() - seen < 60_000, lastSeen: seen } });
}

/** POST /api/video/jobs — nouveau montage (les rushs sont envoyés ensuite via /api/video/upload). */
export async function POST(req: Request) {
  const b = (await req.json()) as { title?: string; cta?: string; style?: string; formats?: string[]; duration?: number; variants?: number; assets?: Partial<VideoAssets> };
  const formats = (b.formats ?? []).filter((f): f is VideoFormat => (FORMATS as string[]).includes(f));
  const job = await addJob({
    title: String(b.title ?? "").slice(0, 200),
    cta: String(b.cta ?? "").slice(0, 120),
    style: (STYLES as string[]).includes(b.style ?? "") ? (b.style as VideoStyle) : "rapide",
    formats: formats.length ? formats : ["9:16"],
    duration: Math.min(180, Math.max(0, Math.round(Number(b.duration) || 0))),
    variants: Math.min(3, Math.max(1, Math.round(Number(b.variants) || 3))),
    assets: { intro: true, logo: true, titles: true, endCard: true, orbi: true, ...(b.assets ?? {}) },
  });
  return Response.json({ job });
}
