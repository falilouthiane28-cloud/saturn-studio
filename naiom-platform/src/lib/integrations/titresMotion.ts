/**
 * Titres des vidéos motion design, rendus par Chromium (Puppeteer) puis posés sur les clips par
 * ffmpeg : vraie typographie, un mot accentué dans la couleur de marque, logo final avec halo.
 * Trois animations : « fondu » (un PNG, fondu d'entrée), « frappe » (texte tapé lettre par lettre
 * avec curseur qui clignote, comme les références Hera et Claude) et « mots » (apparition mot par
 * mot). Les animations sont des séquences de PNG à 30 i/s. Les images Higgsfield n'ont jamais de texte.
 */
import path from "node:path";
import fs from "node:fs/promises";
import type { FormatVideo, Ton, TypeScene } from "../instagram/motion.ts";
import { segmentsTitre } from "../instagram/motion.ts";

export type AnimationTitre = "fondu" | "frappe" | "mots";
export interface Titre { texte: string; ton: Ton; type: TypeScene; animation?: AnimationTitre }
/** Un titre rendu : un PNG fixe, ou une séquence de PNG (motif ffmpeg) à 30 i/s. */
export type TitreRendu =
  | { kind: "image"; fichier: string }
  | { kind: "sequence"; motif: string; images: number; frappes: number[] }; // frappes : instants (s) des lettres ou mots, pour le son

export const FPS_TITRE = 30;
const LETTRES_PAR_S = 18;
const DEBUT_S = 0.2;

export const dimensions = (f: FormatVideo) => (f === "16:9" ? { w: 1280, h: 720 } : { w: 720, h: 1280 });

/** Animation par défaut : l'interface et l'accroche des styles « SaaS » sont tapées, l'accroche clean apparaît mot par mot. */
export function animationPar(type: TypeScene, style: string): AnimationTitre {
  if (type === "UI") return "frappe";
  if (type === "HOOK") return style === "clean-explainer" ? "mots" : "frappe";
  return "fondu";
}

const echapper = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
/** Scènes où le visuel occupe le centre : le titre monte en haut du cadre. */
const EN_HAUT = new Set<TypeScene>(["CONTEXT", "SOLUTION", "PROOF", "UI"]);

/** Nombre de caractères visibles du titre (sans les astérisques). */
export const longueurTitre = (t: string) => segmentsTitre(t).reduce((a, s) => a + [...s.texte].length, 0);

/**
 * HTML d'un titre (pur, testé sans navigateur). `visibles` : nombre de caractères affichés (les
 * autres restent en place, transparents, pour que la mise en page ne bouge pas) ; `curseur` : barre
 * de saisie après le dernier caractère visible.
 */
export function htmlTitre(t: Titre, format: FormatVideo, accent: string, etat: { visibles?: number; curseur?: boolean } = {}): string {
  const { w, h } = dimensions(format);
  const logo = t.type === "LOGO";
  // Grand titre centré (accroche, tension, CTA), plus petit en haut d'une interface, logo plus grand.
  const taille = Math.round((format === "16:9" ? w * 0.06 : w * 0.1) * (logo ? 1.35 : EN_HAUT.has(t.type) ? 0.8 : 1));
  const couleur = t.ton === "clair" ? "#1A1A1A" : "#FFFFFF";
  // Accent éclairci sur fond sombre (contraste lisible), jaune doux sur l'aplat de marque.
  const couleurAccent = t.ton === "marque" ? "#FFE5A0" : t.ton === "sombre" ? `color-mix(in srgb, ${accent} 55%, white)` : accent;
  const halo = t.ton === "clair" ? "none" : `0 0 ${logo ? 48 : 24}px ${logo ? accent : "rgba(255,255,255,0.35)"}`;
  const curseur = `<span style="display:inline-block;width:0.07em;height:0.95em;margin:0 0.03em;vertical-align:-0.12em;background:${couleurAccent}"></span>`;
  let reste = etat.visibles ?? Infinity;
  let curseurPose = !etat.curseur;
  const corps = segmentsTitre(t.texte).map((s) => {
    const car = [...s.texte];
    const vus = Math.max(0, Math.min(car.length, reste));
    reste -= vus;
    const style = s.accent ? ` style="color:${couleurAccent}"` : "";
    let html = vus ? `<span${style}>${echapper(car.slice(0, vus).join(""))}</span>` : "";
    if (!curseurPose && vus < car.length) { html += curseur; curseurPose = true; }
    if (vus < car.length) html += `<span${style ? style.replace('"', '"opacity:0;') : ' style="opacity:0"'}>${echapper(car.slice(vus).join(""))}</span>`;
    return html;
  }).join("") + (curseurPose ? "" : curseur);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:${w}px;height:${h}px;background:transparent}
.c{position:absolute;inset:0;display:flex;justify-content:center;align-items:${EN_HAUT.has(t.type) ? "flex-start" : "center"};padding:${EN_HAUT.has(t.type) ? Math.round(h * 0.1) : 0}px ${Math.round(w * 0.1)}px 0;box-sizing:border-box}
.t{font-family:Inter,"Noto Sans","Segoe UI",Arial,sans-serif;font-weight:800;font-size:${taille}px;line-height:1.08;letter-spacing:${logo ? "0.02em" : "-0.02em"};text-align:center;color:${couleur};text-shadow:${halo}}
</style></head><body><div class="c"><div class="t">${corps}</div></div></body></html>`;
}

/**
 * Images d'une animation : pour chaque image (30 i/s), l'état du titre. Frappe : 18 lettres par
 * seconde puis curseur qui clignote 1 s ; mots : un mot toutes les 0,2 s. Départ à 0,2 s.
 */
export function imagesAnimation(texte: string, animation: Exclude<AnimationTitre, "fondu">): { etats: { visibles: number; curseur: boolean }[]; frappes: number[] } {
  const total = longueurTitre(texte);
  const etats: { visibles: number; curseur: boolean }[] = [];
  const frappes: number[] = [];
  const attente = Math.round(DEBUT_S * FPS_TITRE);
  if (animation === "frappe") {
    for (let i = 0; i < attente; i++) etats.push({ visibles: 0, curseur: i % 15 < 8 });
    const duree = Math.ceil((total / LETTRES_PAR_S) * FPS_TITRE);
    let avant = 0;
    for (let i = 1; i <= duree; i++) {
      const n = Math.min(total, Math.round((i / duree) * total));
      if (n > avant) { frappes.push(+((attente + i) / FPS_TITRE).toFixed(3)); avant = n; }
      etats.push({ visibles: n, curseur: true });
    }
    for (let i = 0; i < FPS_TITRE; i++) etats.push({ visibles: total, curseur: i % 15 < 8 });
    etats.push({ visibles: total, curseur: false });
  } else {
    const bornes: number[] = [];
    let n = 0;
    for (const s of segmentsTitre(texte)) for (const m of s.texte.split(/(\s+)/)) { n += [...m].length; if (m.trim()) bornes.push(n); }
    for (let i = 0; i < attente; i++) etats.push({ visibles: 0, curseur: false });
    bornes.forEach((b, k) => {
      frappes.push(+((attente + k * 6) / FPS_TITRE).toFixed(3));
      for (let i = 0; i < 6; i++) etats.push({ visibles: b, curseur: false });
    });
    etats.push({ visibles: total, curseur: false });
  }
  return { etats, frappes };
}

/** Rend les titres (PNG fixes ou séquences) dans `dossier`. null quand la scène n'a pas de titre. */
export async function rendreTitres(titres: Titre[], format: FormatVideo, accent: string, dossier: string): Promise<(TitreRendu | null)[]> {
  if (!titres.some((t) => t.texte.trim())) return titres.map(() => null);
  const { default: puppeteer } = await import("puppeteer");
  const { w, h } = dimensions(format);
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    const capture = async (html: string) => {
      await page.setContent(html, { waitUntil: "load" });
      return (await page.screenshot({ type: "png", omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } })) as Buffer;
    };
    const sorties: (TitreRendu | null)[] = [];
    for (const [i, t] of titres.entries()) {
      if (!t.texte.trim()) { sorties.push(null); continue; }
      const anim = t.animation ?? "fondu";
      if (anim === "fondu") {
        const f = path.join(dossier, `titre-${String(i + 1).padStart(2, "0")}.png`);
        await fs.writeFile(f, await capture(htmlTitre(t, format, accent)));
        sorties.push({ kind: "image", fichier: f });
        continue;
      }
      const rep = path.join(dossier, `titre-${String(i + 1).padStart(2, "0")}`);
      await fs.mkdir(rep, { recursive: true });
      const { etats, frappes } = imagesAnimation(t.texte, anim);
      const cache = new Map<string, Buffer>(); // un seul rendu par état distinct
      for (const [k, e] of etats.entries()) {
        const cle = `${e.visibles}-${e.curseur}`;
        if (!cache.has(cle)) cache.set(cle, await capture(htmlTitre(t, format, accent, e)));
        await fs.writeFile(path.join(rep, `f_${String(k).padStart(4, "0")}.png`), cache.get(cle)!);
      }
      sorties.push({ kind: "sequence", motif: path.join(rep, "f_%04d.png"), images: etats.length, frappes });
    }
    return sorties;
  } finally {
    await browser.close();
  }
}
