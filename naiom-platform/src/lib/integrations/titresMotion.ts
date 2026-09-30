/**
 * Titres des vidéos motion design, rendus en PNG transparents par Chromium (Puppeteer) puis posés
 * sur les clips par ffmpeg : vraie typographie, un mot accentué dans la couleur de marque, logo
 * final avec halo. Les images Higgsfield ne contiennent jamais de texte (rendu peu fiable).
 */
import path from "node:path";
import fs from "node:fs/promises";
import type { FormatVideo, Ton, TypeScene } from "../instagram/motion.ts";
import { segmentsTitre } from "../instagram/motion.ts";

export interface Titre { texte: string; ton: Ton; type: TypeScene }

export const dimensions = (f: FormatVideo) => (f === "16:9" ? { w: 1280, h: 720 } : { w: 720, h: 1280 });

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Scènes où le visuel occupe le centre : le titre monte en haut du cadre. */
const EN_HAUT = new Set<TypeScene>(["CONTEXT", "SOLUTION", "PROOF", "UI"]);

/** HTML d'un titre (pur, testé sans navigateur). */
export function htmlTitre(t: Titre, format: FormatVideo, accent: string): string {
  const { w, h } = dimensions(format);
  const logo = t.type === "LOGO";
  // Grand titre centré (accroche, tension, CTA), plus petit en haut d'une interface, logo plus grand.
  const taille = Math.round((format === "16:9" ? w * 0.06 : w * 0.1) * (logo ? 1.35 : EN_HAUT.has(t.type) ? 0.8 : 1));
  const couleur = t.ton === "clair" ? "#1A1A1A" : "#FFFFFF";
  const couleurAccent = t.ton === "marque" ? "#FFE5A0" : accent;
  const halo = t.ton === "clair" ? "none" : `0 0 ${logo ? 48 : 24}px ${logo ? accent : "rgba(255,255,255,0.35)"}`;
  const corps = segmentsTitre(t.texte)
    .map((s) => (s.accent ? `<span style="color:${couleurAccent}">${echapper(s.texte)}</span>` : echapper(s.texte)))
    .join("");
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${w}px;height:${h}px;background:transparent}
.c{position:absolute;inset:0;display:flex;justify-content:center;align-items:${EN_HAUT.has(t.type) ? "flex-start" : "center"};padding:${EN_HAUT.has(t.type) ? Math.round(h * 0.1) : 0}px ${Math.round(w * 0.1)}px 0;box-sizing:border-box}
.t{font-family:Inter,"Noto Sans","Segoe UI",Arial,sans-serif;font-weight:800;font-size:${taille}px;line-height:1.08;letter-spacing:${logo ? "0.02em" : "-0.02em"};text-align:center;color:${couleur};text-shadow:${halo}}
</style></head><body><div class="c"><div class="t">${corps}</div></div></body></html>`;
}

/** Rend chaque titre non vide en PNG transparent dans `dossier`. Renvoie les chemins (null si pas de titre). */
export async function rendreTitres(titres: Titre[], format: FormatVideo, accent: string, dossier: string): Promise<(string | null)[]> {
  if (!titres.some((t) => t.texte.trim())) return titres.map(() => null);
  const { default: puppeteer } = await import("puppeteer");
  const { w, h } = dimensions(format);
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    const sorties: (string | null)[] = [];
    for (const [i, t] of titres.entries()) {
      if (!t.texte.trim()) { sorties.push(null); continue; }
      await page.setContent(htmlTitre(t, format, accent), { waitUntil: "load" });
      const f = path.join(dossier, `titre-${String(i + 1).padStart(2, "0")}.png`);
      await fs.writeFile(f, (await page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } })) as Buffer);
      sorties.push(f);
    }
    return sorties;
  } finally {
    await browser.close();
  }
}
