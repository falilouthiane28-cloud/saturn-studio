import fs from "node:fs/promises";
import path from "node:path";
import puppeteer, { type Browser } from "puppeteer";
import { parseDeckMarkdown } from "../presentations/parseMarkdown";
import type { Presentation } from "../presentations/template";
import { renderCarouselSlideHTML, type CarouselRatio } from "./template";
import { heroPrompt, parsePosterMarkdown, renderPosterSlideHTML } from "./posterTemplate";
import { generateImage, isNanoBananaConfigured } from "../integrations/nanoBanana";
import { generateHiggsfieldImage, isHiggsfieldApiConfigured } from "../integrations/higgsfieldApi";
import { logoDataUri } from "../brand/logo";

export type CarouselStyle = "editorial" | "poster";

export const PUBLIC_CAROUSELS_DIR = path.join(process.cwd(), "public", "generated-carousels");
export const PUBLIC_CAROUSELS_URL = "/generated-carousels";

const DIMENSIONS: Record<CarouselRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
};

export interface GeneratedSlide {
  index: number;
  filename: string;
  publicUrl: string;
  absPath: string;
  bytes: number;
}

export interface GenerateCarouselResult {
  slides: GeneratedSlide[];
  total: number;
  title: string;
  ratio: CarouselRatio;
  style: CarouselStyle;
  /** Remarques non bloquantes (ex. visuels Gemini indisponibles → motif graphique). */
  notes: string[];
}

/**
 * Génère un carrousel à partir d'un markdown de deck.
 * Produit 1 PNG par slide via Puppeteer — texte rendu par le navigateur,
 * donc 100 % fidèle au markdown source (pas d'hallucination d'un modèle image).
 */
/**
 * Extrait le deck d'un fichier livrable Créateur :
 *  - s'il existe un bloc ```markdown ... ``` (ou ```deck) dans le fichier,
 *    on prend uniquement son contenu (le reste = metadata narrative à ignorer) ;
 *  - sinon, on utilise le markdown entier.
 * Cela évite que les sections « Contexte », « Framework », « Hook variante A »,
 * « Notes de production » etc. deviennent des slides `content` parasites.
 */
function extractDeckMarkdown(raw: string): string {
  const fenceMatch = raw.match(/```(?:markdown|deck|md)\s*\n([\s\S]*?)\n```/i);
  if (fenceMatch) return fenceMatch[1].trim();
  return raw;
}

export async function generateCarousel(
  markdown: string,
  opts: { ratio?: CarouselRatio; slug?: string; style?: CarouselStyle } = {}
): Promise<GenerateCarouselResult> {
  const ratio: CarouselRatio = opts.ratio ?? "1:1";
  if (opts.style === "poster") return generatePoster(markdown, ratio, opts.slug);
  const deckMarkdown = extractDeckMarkdown(markdown);
  const deck: Presentation = parseDeckMarkdown(deckMarkdown, "Carrousel");
  if (deck.slides.length === 0) {
    throw new Error("Aucune slide détectée dans le markdown. Utilise ## [stat] Titre, ## [quote] …, etc.");
  }

  const dim = DIMENSIONS[ratio];
  const brand = deck.brand ?? "Saturn Studio";
  const total = deck.slides.length;

  await fs.mkdir(PUBLIC_CAROUSELS_DIR, { recursive: true });

  const slugBase = (opts.slug ?? slugifyTitle(deck.title)).slice(0, 40) || "carousel";
  const batchId = `${new Date().toISOString().slice(0, 10)}-${slugBase}-${Date.now()}`;

  const browser: Browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: dim.width, height: dim.height, deviceScaleFactor: 1 });

    const generated: GeneratedSlide[] = [];
    for (let i = 0; i < deck.slides.length; i++) {
      const html = renderCarouselSlideHTML(deck.slides[i], { brand, ratio, index: i, total });
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 30000 });

      try {
        await Promise.race([
          page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready.then(() => true)),
          new Promise((r) => setTimeout(r, 5000)),
        ]);
      } catch {
        // fonts fallback
      }

      const pngBuffer = (await page.screenshot({
        type: "png",
        clip: { x: 0, y: 0, width: dim.width, height: dim.height },
      })) as Buffer;

      const filename = `${batchId}-${String(i + 1).padStart(2, "0")}.png`;
      const absPath = path.join(PUBLIC_CAROUSELS_DIR, filename);
      await fs.writeFile(absPath, pngBuffer);

      generated.push({
        index: i,
        filename,
        publicUrl: `${PUBLIC_CAROUSELS_URL}/${filename}`,
        absPath,
        bytes: pngBuffer.length,
      });
    }

    return { slides: generated, total, title: deck.title, ratio, style: "editorial", notes: [] };
  } finally {
    await browser.close();
  }
}

function slugifyTitle(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "carousel"
  );
}

/** Style « Poster » (signature de Fatou) : texte HTML + visuel héros Gemini optionnel. */
async function generatePoster(markdown: string, ratio: CarouselRatio, slug?: string): Promise<GenerateCarouselResult> {
  const deck = parsePosterMarkdown(markdown);
  if (!deck.slides.length) throw new Error("Aucune slide : chaque slide commence par « ## Titre ».");
  const dim = DIMENSIONS[ratio];
  const notes: string[] = [];
  // Moteur des visuels héros : Higgsfield s'il est configuré, sinon Gemini.
  const engine = isHiggsfieldApiConfigured() ? "Higgsfield" : isNanoBananaConfigured() ? "Gemini" : null;
  let visuals = engine !== null;
  if (!engine) notes.push("Aucun moteur d'images configuré (Higgsfield ou Gemini) : motif graphique utilisé.");

  await fs.mkdir(PUBLIC_CAROUSELS_DIR, { recursive: true });
  const logo = { black: await logoDataUri("black"), white: await logoDataUri("white") };
  const batchId = `${new Date().toISOString().slice(0, 10)}-${(slug ?? slugifyTitle(deck.title)).slice(0, 40)}-${Date.now()}`;
  const browser: Browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: dim.width, height: dim.height, deviceScaleFactor: 1 });
    const generated: GeneratedSlide[] = [];
    for (let i = 0; i < deck.slides.length; i++) {
      const slide = deck.slides[i];
      let heroDataUri: string | undefined;
      if (visuals && slide.visual) {
        try {
          const prompt = heroPrompt(slide.visual, i % 2 === 0);
          if (engine === "Higgsfield") {
            const img = await generateHiggsfieldImage(prompt, "1:1");
            heroDataUri = `data:${img.mime};base64,${img.bytes.toString("base64")}`;
          } else {
            const img = await generateImage(prompt, { slug: "lea-poster" });
            heroDataUri = `data:image/png;base64,${(await fs.readFile(img.absPath)).toString("base64")}`;
          }
        } catch (e) {
          // Crédits, facturation… : on n'insiste pas pour les slides suivantes.
          visuals = false;
          notes.push(`Visuels ${engine} indisponibles (${e instanceof Error ? e.message.slice(0, 140) : "erreur"}) : motif graphique utilisé.`);
        }
      }
      // Le fond de la slide suit celui du visuel (le modèle ne respecte pas toujours
      // « fond blanc / fond noir ») : on mesure la luminosité des coins de l'image.
      const dark = heroDataUri ? await cornersAreDark(page, heroDataUri) : undefined;
      const html = renderPosterSlideHTML(slide, { ratio, index: i, total: deck.slides.length, brand: "Saturn Studio", heroDataUri, dark, logo });
      await page.setContent(html, { waitUntil: "load", timeout: 30000 });
      await Promise.race([
        page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready.then(() => true)),
        new Promise((r) => setTimeout(r, 6000)),
      ]).catch(() => undefined);
      const png = (await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: dim.width, height: dim.height } })) as Buffer;
      const filename = `${batchId}-${String(i + 1).padStart(2, "0")}.png`;
      const absPath = path.join(PUBLIC_CAROUSELS_DIR, filename);
      await fs.writeFile(absPath, png);
      generated.push({ index: i, filename, publicUrl: `${PUBLIC_CAROUSELS_URL}/${filename}`, absPath, bytes: png.length });
    }
    return { slides: generated, total: generated.length, title: deck.title, ratio, style: "poster", notes };
  } finally {
    await browser.close();
  }
}

/** Luminosité moyenne des 4 coins d'une image (< 50 % → fond sombre). */
async function cornersAreDark(page: import("puppeteer").Page, dataUri: string): Promise<boolean | undefined> {
  try {
    await page.setContent("<html><body></body></html>");
    return await page.evaluate(async (src: string) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const s = Math.max(4, Math.round(c.width * 0.06));
      let sum = 0;
      let n = 0;
      for (const [x, y] of [[0, 0], [c.width - s, 0], [0, c.height - s], [c.width - s, c.height - s]]) {
        const d = ctx.getImageData(x, y, s, s).data;
        for (let k = 0; k < d.length; k += 4) {
          sum += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
          n++;
        }
      }
      return sum / n < 128;
    }, dataUri);
  } catch {
    return undefined; // mesure impossible : alternance par défaut
  }
}
