import { generateCarousel } from "@/lib/carousels/generate";

export const runtime = "nodejs";
// Style poster : un visuel Gemini par slide (~10 s chacun).
export const maxDuration = 300;

/**
 * POST /api/carousels/generate
 * body: { markdown, ratio?: "1:1" | "4:5" | "9:16", slug?, style?: "editorial" | "poster" }
 * → produit N PNGs (1 par slide) via Puppeteer, texte 100 % fidèle.
 */
export async function POST(req: Request) {
  try {
    const { markdown, ratio, slug, style } = await req.json();
    if (!markdown || typeof markdown !== "string") {
      return Response.json({ error: "markdown (string) requis" }, { status: 400 });
    }
    const allowed = new Set(["1:1", "4:5", "9:16"]);
    if (ratio && !allowed.has(ratio)) {
      return Response.json({ error: "ratio doit être 1:1, 4:5 ou 9:16" }, { status: 400 });
    }

    const result = await generateCarousel(markdown, { ratio, slug, style: style === "poster" ? "poster" : "editorial" });

    return Response.json({
      success: true,
      title: result.title,
      ratio: result.ratio,
      total: result.total,
      style: result.style,
      notes: result.notes,
      slides: result.slides.map((s) => ({
        index: s.index,
        filename: s.filename,
        publicUrl: s.publicUrl,
        bytes: s.bytes,
      })),
    });
  } catch (err) {
    console.error("[carousels/generate]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
