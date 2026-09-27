/**
 * Logo Saturn Studio — présent sur TOUTES les créations.
 *  - rendus HTML (carrousels, decks, visuels hybrides) : logoImg() dans la mise en page ;
 *  - images générées par l'IA (Higgsfield…) : stampLogo() l'appose sur l'image finie.
 * Fichiers : public/brand/saturn-logo-{black,white}.png (fond transparent).
 */
import { promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

export type LogoVariant = "black" | "white";

const BRAND_DIR = path.join(process.cwd(), "public", "brand");
const cache = new Map<LogoVariant, Buffer>();

async function logoBuffer(v: LogoVariant): Promise<Buffer> {
  const hit = cache.get(v);
  if (hit) return hit;
  const buf = await fs.readFile(path.join(BRAND_DIR, `saturn-logo-${v}.png`));
  cache.set(v, buf);
  return buf;
}

/** Logo en data URI (utilisable dans un HTML rendu par Puppeteer). */
export async function logoDataUri(v: LogoVariant): Promise<string> {
  return `data:image/png;base64,${(await logoBuffer(v)).toString("base64")}`;
}

/** Balise <img> du logo, largeur en px (ratio conservé). */
export async function logoImg(v: LogoVariant, width: number, style = ""): Promise<string> {
  return `<img src="${await logoDataUri(v)}" alt="Saturn Studio" style="display:block;width:${width}px;height:auto;${style}">`;
}

/**
 * Appose le logo sur une image (coin haut-gauche par défaut), en blanc ou en noir
 * selon la luminosité de la zone qui le reçoit. Renvoie un PNG.
 */
export async function stampLogo(
  input: Buffer,
  opts: { corner?: "top-left" | "top-right" | "bottom-left" | "bottom-right"; widthRatio?: number } = {}
): Promise<Buffer> {
  const img = sharp(input).rotate();
  const meta = await img.metadata();
  const W = meta.width ?? 1080;
  const H = meta.height ?? 1080;
  const logoW = Math.round(W * (opts.widthRatio ?? 0.2));
  const margin = Math.round(W * 0.045);
  const corner = opts.corner ?? "top-left";

  const logo = sharp(await logoBuffer("black")).resize({ width: logoW });
  const logoMeta = await logo.metadata();
  const logoH = Math.round(((logoMeta.height ?? 266) * logoW) / (logoMeta.width ?? 830));
  const left = corner.endsWith("left") ? margin : W - logoW - margin;
  const top = corner.startsWith("top") ? margin : H - logoH - margin;

  // Luminosité moyenne de la zone sous le logo → logo blanc sur fond sombre, noir sinon.
  const zone = await sharp(input).rotate()
    .extract({ left, top, width: Math.min(logoW, W - left), height: Math.min(logoH, H - top) })
    .greyscale().stats();
  const variant: LogoVariant = zone.channels[0].mean < 128 ? "white" : "black";
  const mark = await sharp(await logoBuffer(variant)).resize({ width: logoW }).png().toBuffer();

  return img.composite([{ input: mark, left, top }]).png().toBuffer();
}

/** Télécharge une image générée, appose le logo, l'enregistre dans public/<dir> et renvoie son URL publique. */
export async function stampRemoteImage(url: string, dir = "generated-images", name?: string): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Téléchargement de l'image impossible (${res.status}).`);
  const stamped = await stampLogo(Buffer.from(await res.arrayBuffer()));
  const file = `${name ?? `brand-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}.png`;
  const abs = path.join(process.cwd(), "public", dir, file);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, stamped);
  return `/${dir}/${file}`;
}

/** Version synchrone (rendus HTML générés par des fonctions synchrones). */
export function logoDataUriSync(v: LogoVariant): string {
  const buf = cache.get(v) ?? readFileSync(path.join(BRAND_DIR, `saturn-logo-${v}.png`));
  cache.set(v, buf);
  return `data:image/png;base64,${buf.toString("base64")}`;
}

/** Appose le logo sur un fichier image existant (remplacé en place, en PNG). */
export async function stampLocalFile(absPath: string, opts?: Parameters<typeof stampLogo>[1]): Promise<void> {
  await fs.writeFile(absPath, await stampLogo(await fs.readFile(absPath), opts));
}
