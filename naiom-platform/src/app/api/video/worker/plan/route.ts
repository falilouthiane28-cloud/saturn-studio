import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { workerAuthorized } from "@/lib/video/store";

export const runtime = "nodejs";
export const maxDuration = 180;

interface Unit { id: string; clip: number; from: number; to: number; kind: "speech" | "shot" }
interface PlanReq {
  job: { title?: string; cta?: string; style?: string; duration?: number; guidance?: string; previousPlan?: unknown };
  clips: { index: number; name: string; duration: number; hasSpeech: boolean }[];
  units: Unit[];
  keyframes: { unit: string; jpeg: string }[]; // base64, une image par unité (échantillon)
}

const STYLE_HINT: Record<string, string> = {
  rapide: "montage nerveux type TikTok : on garde l'essentiel, rythme élevé, textes courts et percutants",
  informatif: "montage clair et posé : on garde les explications complètes, textes qui résument chaque idée",
  suspense: "montage qui crée l'attente : l'accroche pose une question, la réponse arrive à la fin",
  humour: "montage comique : on garde les réactions et chutes, textes décalés avec une pointe d'humour",
};

/**
 * POST /api/video/worker/plan — le poste de montage envoie la structure détectée (unités de
 * parole ou plans, une image clé par unité) ; Fatou (Claude, vision) choisit les unités à garder,
 * leur priorité, l'accroche, les textes à l'écran et le cadrage. Les coupes restent calées sur
 * les unités détectées : la parole n'est jamais coupée au milieu.
 */
export async function POST(req: Request) {
  if (!workerAuthorized(req)) return Response.json({ error: "Jeton du poste de montage invalide" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "ANTHROPIC_API_KEY absente" }, { status: 412 });
  const body = (await req.json()) as PlanReq;
  const units = (body.units ?? []).slice(0, 60);
  if (!units.length) return Response.json({ error: "Aucune unité à monter" }, { status: 400 });
  const j = body.job ?? {};
  const style = j.style ?? "rapide";

  const content: ({ type: "text"; text: string } | { type: "image"; image: Buffer; mediaType: "image/jpeg" })[] = [];
  content.push({ type: "text", text: `Rushs : ${body.clips.map((c) => `clip ${c.index} « ${c.name} » ${c.duration.toFixed(1)}s${c.hasSpeech ? " (parole)" : " (sans parole)"}`).join(" ; ")}
Unités détectées (ordre chronologique) :
${units.map((u) => `${u.id} : clip ${u.clip}, ${u.from.toFixed(2)}→${u.to.toFixed(2)}s (${(u.to - u.from).toFixed(1)}s, ${u.kind === "speech" ? "passage parlé" : "plan"})`).join("\n")}
Images clés (une par unité, dans l'ordre) :` });
  for (const k of (body.keyframes ?? []).slice(0, 24)) {
    content.push({ type: "text", text: `Image de ${k.unit} :` });
    content.push({ type: "image", image: Buffer.from(k.jpeg, "base64"), mediaType: "image/jpeg" });
  }
  content.push({ type: "text", text: `Brief du montage :
- Sujet / accroche souhaitée : ${j.title || "(à déduire des images)"}
- Appel à l'action final : ${j.cta || "(à proposer)"}
- Style : ${style} — ${STYLE_HINT[style] ?? ""}
- Durée visée : ${j.duration ? `${j.duration} s` : "automatique (la plus efficace possible, idéalement 20 à 60 s)"}
${j.guidance ? `- RETOUR DE FALLOU SUR LA VERSION PRÉCÉDENTE (priorité absolue) : ${j.guidance}` : ""}
${j.previousPlan ? `- Plan précédent : ${JSON.stringify(j.previousPlan).slice(0, 2500)}` : ""}

Tu es Fatou, monteuse et directrice artistique de Saturn Studio. Choisis les unités à garder (jamais celles où il ne se passe rien, les ratés, les blancs), dans l'ordre chronologique.
Pour chaque unité gardée : priority 1 (indispensable), 2 (utile) ou 3 (bonus coupé si on manque de temps) ; caption = texte à l'écran en français, 2 à 6 mots, qui renforce le message (vide "" si l'image se suffit) ; focusX = position horizontale du sujet principal dans l'image (0 = bord gauche, 0.5 = centre, 1 = bord droit), pour recadrer en vertical sans couper le sujet.
Choisis aussi hookUnit : l'unité la plus forte pour ouvrir la vidéo en teaser.
Réponds UNIQUEMENT avec ce JSON :
{"hook":"accroche à l'écran, 3 à 8 mots","cta":"appel à l'action court","keep":[{"unit":"u0","priority":1,"caption":"","focusX":0.5}],"hookUnit":"u0","notes":"ton parti pris de montage en une phrase"}` });

  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const { text } = await generateText({ model: anthropic("claude-sonnet-5"), maxOutputTokens: 4000, messages: [{ role: "user", content }] });
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const plan = JSON.parse(cleaned.slice(cleaned.indexOf("{"), cleaned.lastIndexOf("}") + 1)) as {
      hook?: string; cta?: string; keep?: { unit: string; priority?: number; caption?: string; focusX?: number }[]; hookUnit?: string; notes?: string;
    };
    const ids = new Set(units.map((u) => u.id));
    const keep = (plan.keep ?? []).filter((k) => ids.has(k.unit)).map((k) => ({
      unit: k.unit,
      priority: Math.min(3, Math.max(1, Math.round(Number(k.priority) || 2))),
      caption: String(k.caption ?? "").slice(0, 60),
      focusX: Math.min(1, Math.max(0, Number(k.focusX ?? 0.5))),
    }));
    return Response.json({
      hook: String(plan.hook ?? j.title ?? "").slice(0, 80),
      cta: String(plan.cta ?? j.cta ?? "Suis Saturn Studio").slice(0, 80),
      keep: keep.length ? keep : units.map((u) => ({ unit: u.id, priority: 2, caption: "", focusX: 0.5 })),
      hookUnit: plan.hookUnit && ids.has(plan.hookUnit) ? plan.hookUnit : (keep[0]?.unit ?? units[0].id),
      notes: String(plan.notes ?? ""),
    });
  } catch (e) {
    return Response.json({ error: `Analyse impossible : ${e instanceof Error ? e.message : e}` }, { status: 502 });
  }
}
