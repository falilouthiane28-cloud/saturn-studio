import fs from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";
import sharp from "sharp";
import { getPost, updatePost } from "@/lib/content/store";
import { composeDirection, directionOf, slidesOf } from "@/lib/content/directions";
import { zipStore } from "@/lib/zip";

export const runtime = "nodejs";
export const maxDuration = 300;

const PUBLIC_DIR = path.join(process.cwd(), "public");

/** URL publique d'une image rendue (« /content-out/x.png?v=… ») → chemin disque, sans sortir de public/. */
function fileOf(url: string): string {
  const abs = path.resolve(PUBLIC_DIR, "." + decodeURIComponent(url.split("?")[0]));
  if (!abs.startsWith(PUBLIC_DIR + path.sep)) throw new Error("Chemin d'image invalide.");
  return abs;
}

/**
 * POST /api/content/download { id, format?: "pdf" | "zip" }
 * Renvoie les VRAIES images du post (celles de l'aperçu) : un PDF d'une page par slide
 * (format carrousel LinkedIn) ou un ZIP des PNG. Si le post n'a pas encore d'images,
 * elles sont rendues maintenant dans sa direction Saturn.
 */
export async function POST(req: Request) {
  try {
    const { id, format = "pdf" } = (await req.json()) as { id?: string; format?: "pdf" | "zip" };
    if (!id) return Response.json({ error: "id requis" }, { status: 400 });
    const post = await getPost(id);
    if (!post) return Response.json({ error: "Post introuvable" }, { status: 404 });

    if (post.visuals && !post.visuals.done)
      return Response.json({ error: "Les scènes d'Orbi sont encore en cours de création : réessaie dans une minute." }, { status: 409 });
    let images = (post.visuals?.images ?? []).filter((x): x is string => !!x);
    if (!images.length) {
      const slides = slidesOf(post.result);
      if (!slides.length) return Response.json({ error: "Ce post est un texte seul : il n'a pas d'images à télécharger." }, { status: 400 });
      images = await composeDirection(id, post.platform, slides, directionOf(post.refId) ?? "vanguard");
      await updatePost(id, { visuals: { jobs: [], images, done: true } });
    }
    const pngs = await Promise.all(images.map((u) => fs.readFile(fileOf(u))));
    const base = `saturn-${post.platform}-${post.id}`;

    if (format === "zip") {
      const zip = zipStore(pngs.map((data, i) => ({ name: `${base}-${String(i + 1).padStart(2, "0")}.png`, data })));
      return new Response(new Uint8Array(zip), {
        headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${base}.zip"` },
      });
    }

    const { width = 1080, height = 1350 } = await sharp(pngs[0]).metadata();
    const pages = pngs
      .map((b) => `<div class="p"><img src="data:image/png;base64,${b.toString("base64")}"></div>`)
      .join("");
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      @page{size:${width}px ${height}px;margin:0}*{margin:0;padding:0}
      .p{width:${width}px;height:${height}px;page-break-after:always;overflow:hidden}.p:last-child{page-break-after:auto}
      .p img{display:block;width:100%;height:100%;object-fit:cover}
    </style></head><body>${pages}</body></html>`;
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load", timeout: 60000 });
      const pdf = await page.pdf({ width: `${width}px`, height: `${height}px`, printBackground: true });
      return new Response(new Uint8Array(pdf), {
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"` },
      });
    } finally {
      await browser.close();
    }
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Erreur" }, { status: 500 });
  }
}
