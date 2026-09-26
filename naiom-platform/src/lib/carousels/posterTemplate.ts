/**
 * Template carrousel « POSTER » — la signature visuelle de Léa.
 *
 * Principes (tirés des planches de référence, sans les copier) :
 *  1. Titre massif en capitales, grotesque condensée, interlignage serré ;
 *     UN seul mot mis en valeur (**mot** → accent, ==mot== → pastille).
 *  2. Un sujet héros central qui mord sur le titre (profondeur).
 *  3. Base noir/blanc à fort contraste + un seul accent néon (violet).
 *  4. Motifs : bandes cadrées, mot fantôme géant en contour, repères de
 *     recadrage façon logiciel, grain, barres glitch.
 *  5. Rythme : slides sombres et claires en alternance, texte court centré.
 *
 * Le texte est rendu par le navigateur (100 % fidèle) ; seul le visuel héros
 * vient de Gemini (optionnel). Sans visuel, un motif graphique prend le relais.
 */
import type { CarouselRatio } from "./template";

export interface PosterSlide {
  headline: string;
  kicker?: string;
  body?: string;
  /** Description du visuel héros (prompt Gemini). */
  visual?: string;
}

export interface PosterDeck {
  title: string;
  slides: PosterSlide[];
}

const DIM: Record<CarouselRatio, { w: number; h: number }> = {
  "1:1": { w: 1080, h: 1080 },
  "4:5": { w: 1080, h: 1350 },
  "9:16": { w: 1080, h: 1920 },
};

const ACCENT = "#8B3DFF";
const ACCENT_SOFT = "#B98CFF";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Format attendu (écrit par Léa) :
 *   # Titre du carrousel
 *   ## Les agents IA **travaillent** la nuit
 *   > sur-titre: Saturn Studio
 *   > visuel: astronaute assis sur une planète, casque réfléchissant
 *   Texte court sous le titre.
 */
export function parsePosterMarkdown(md: string): PosterDeck {
  // Langue obligatoire : le livrable contient aussi un bloc ```yaml de métadonnées.
  const fence = md.match(/```(?:markdown|md|deck)\s*\n([\s\S]*?)\n```/i);
  const src = (fence ? fence[1] : md).replace(/\r/g, "");
  const title = src.match(/^#\s+(.+)$/m)?.[1].trim() ?? "Carrousel";
  const slides: PosterSlide[] = [];
  // Chaque titre (# ou ##) ouvre un bloc. Un « # » sans contenu n'est que le titre
  // interne ; suivi d'un visuel ou d'un texte, c'est une vraie slide (Léa le fait parfois).
  const blocks = src
    .split(/^(?=#{1,2}\s)/m)
    .filter((b) => /^#{1,2}\s/.test(b))
    .filter((b) => b.startsWith("## ") || b.split("\n").slice(1).join("\n").trim().length > 0)
    .map((b) => b.replace(/^#{1,2}\s+/, ""));
  for (const block of blocks) {
    const [head, ...rest] = block.split("\n");
    const slide: PosterSlide = { headline: head.replace(/^\[[a-z]+\]\s*/i, "").trim() };
    const body: string[] = [];
    for (const raw of rest) {
      const line = raw.trim();
      if (!line || /^-{3,}$/.test(line) || /^#\s/.test(line)) continue;
      const meta = line.match(/^>\s*(sur-titre|surtitre|kicker|visuel|visual)\s*:\s*(.+)$/i);
      if (meta) {
        if (/visu/i.test(meta[1])) slide.visual = meta[2].trim();
        else slide.kicker = meta[2].trim();
        continue;
      }
      body.push(line.replace(/^[-*>]\s+/, ""));
    }
    if (body.length) slide.body = body.join(" ").replace(/\*\*/g, "").slice(0, 260);
    if (slide.headline) slides.push(slide);
  }
  return { title, slides };
}

/** Titre → lignes équilibrées (~13 caractères), avec mise en valeur. */
function headlineLines(raw: string): { html: string; len: number }[] {
  const tokens = raw.split(/\s+/).filter(Boolean);
  const lines: string[][] = [];
  let cur: string[] = [];
  let curLen = 0;
  for (const t of tokens) {
    const plain = t.replace(/\*\*|==/g, "");
    if (cur.length && curLen + plain.length + 1 > 13) {
      lines.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(t);
    curLen += plain.length + (cur.length > 1 ? 1 : 0);
  }
  if (cur.length) lines.push(cur);
  return lines.map((words) => {
    const len = words.join(" ").replace(/\*\*|==/g, "").length;
    const html = esc(words.join(" "))
      .replace(/\*\*(.+?)\*\*/g, '<span class="acc">$1</span>')
      .replace(/==(.+?)==/g, '<span class="pill">$1</span>');
    return { html, len };
  });
}

export function renderPosterSlideHTML(
  slide: PosterSlide,
  o: { ratio: CarouselRatio; index: number; total: number; brand: string; handle?: string; heroDataUri?: string }
): string {
  const { w, h } = DIM[o.ratio];
  const dark = o.index % 2 === 0;
  const lines = headlineLines(slide.headline.toUpperCase().replace(/\*\*(.+?)\*\*/g, "**$1**"));
  const longest = Math.max(...lines.map((l) => l.len), 4);
  const fontSize = Math.round(Math.min(o.ratio === "1:1" ? 150 : 176, 960 / (longest * 0.47)));
  const ghost = (slide.headline.replace(/\*\*|==/g, "").split(/\s+/).pop() ?? "").toUpperCase().slice(0, 9);
  const heroH = Math.round(h * (o.ratio === "1:1" ? 0.4 : o.ratio === "4:5" ? 0.46 : 0.5));
  const count = `${String(o.index + 1).padStart(2, "0")} / ${String(o.total).padStart(2, "0")}`;
  const last = o.index === o.total - 1;

  const hero = o.heroDataUri
    ? `<img class="hero-img" src="${o.heroDataUri}" alt="">`
    : motif(o.index % 3);

  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@500;700;800&family=JetBrains+Mono:wght@500&display=block" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{position:relative;font-family:Inter,sans-serif;
  --ink:${dark ? "#F4F2F8" : "#0B0A0F"};--muted:${dark ? "rgba(244,242,248,.72)" : "rgba(11,10,15,.7)"};
  --line:${dark ? "rgba(255,255,255,.14)" : "rgba(0,0,0,.14)"};
  background:${dark ? "#0B0A0F" : "#E7E6EC"};color:var(--ink)}
/* Lumière d'accent + grain + grille */
.bg{position:absolute;inset:0;
  background:${dark
    ? `radial-gradient(60% 40% at 50% 38%, ${ACCENT}55, transparent 70%), radial-gradient(40% 30% at 85% 100%, ${ACCENT}33, transparent 70%)`
    : `repeating-radial-gradient(circle at 70% 30%, transparent 0 22px, rgba(0,0,0,.035) 22px 23px), radial-gradient(50% 40% at 50% 40%, ${ACCENT}22, transparent 70%)`}}
.grid{position:absolute;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:90px 90px;opacity:.35;
  -webkit-mask-image:radial-gradient(70% 60% at 50% 45%,#000,transparent)}
.grain{position:absolute;inset:0;opacity:${dark ? ".18" : ".12"};mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence baseFrequency='.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.ghost{position:absolute;left:50%;bottom:${Math.round(h * 0.04)}px;transform:translateX(-50%);font-family:Anton;font-size:${o.ratio === "1:1" ? 300 : 380}px;line-height:.8;
  color:transparent;-webkit-text-stroke:2px ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.09)"};white-space:nowrap;letter-spacing:.01em}
/* Chrome : logo, compteur, repères de recadrage */
.top{position:absolute;top:56px;left:64px;right:64px;display:flex;justify-content:space-between;align-items:center;z-index:5}
.logo{font-family:Anton;font-size:34px;letter-spacing:.06em}
.logo small{display:block;font-family:Inter;font-weight:700;font-size:11px;letter-spacing:.42em;opacity:.7;margin-top:2px}
.count{font-family:'JetBrains Mono';font-size:20px;opacity:.75}
.crop{position:absolute;width:34px;height:34px;border:0 solid ${dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.35)"};z-index:4}
.c1{top:30px;left:30px;border-top-width:2px;border-left-width:2px}.c2{top:30px;right:30px;border-top-width:2px;border-right-width:2px}
.c3{bottom:30px;left:30px;border-bottom-width:2px;border-left-width:2px}.c4{bottom:30px;right:30px;border-bottom-width:2px;border-right-width:2px}
/* Composition centrale */
.stage{position:absolute;left:0;right:0;top:${o.ratio === "9:16" ? 170 : 130}px;bottom:${o.ratio === "9:16" ? 150 : 118}px;display:flex;flex-direction:column;align-items:center;z-index:3}
.kicker{font-family:'JetBrains Mono';font-size:22px;letter-spacing:.2em;text-transform:uppercase;color:${dark ? ACCENT_SOFT : ACCENT};margin-bottom:18px}
.hero{position:relative;width:${Math.round(w * 0.78)}px;flex:1 1 auto;min-height:${Math.round(heroH * 0.45)}px;max-height:${heroH}px;display:grid;place-items:center}
.hero-img{max-width:100%;max-height:100%;object-fit:contain;mix-blend-mode:${dark ? "screen" : "multiply"};
  -webkit-mask-image:linear-gradient(to bottom,#000 70%,transparent)}
.motif{position:relative;width:100%;height:100%}
.band{position:absolute;border:3px solid var(--ink);overflow:hidden}
.band i{position:absolute;inset:8px;background:
  radial-gradient(circle, var(--ink) 34%, transparent 36%) 0 0/14px 14px;
  -webkit-mask-image:linear-gradient(${dark ? "100deg" : "80deg"},#000 10%,transparent 85%);opacity:.9}
.b1{left:4%;top:4%;width:62%;height:24%}
.b2{left:20%;top:38%;width:70%;height:24%;border-color:${ACCENT}}
.b2 i{background:radial-gradient(circle, ${ACCENT} 34%, transparent 36%) 0 0/14px 14px}
.b3{left:10%;top:72%;width:56%;height:22%}
.glitch{position:absolute;height:10px;background:${ACCENT};box-shadow:0 0 24px ${ACCENT}}
.g1{left:58%;top:34%;width:30%}.g2{left:0;top:66%;width:22%;height:6px;opacity:.8}
.headline{margin-top:-${Math.round(fontSize * 0.55)}px;text-align:center;font-family:Anton;font-size:${fontSize}px;line-height:.92;text-transform:uppercase;letter-spacing:.005em;
  text-shadow:${dark ? "0 8px 40px rgba(0,0,0,.55)" : "0 6px 30px rgba(255,255,255,.6)"};position:relative;z-index:4}
.headline div{white-space:nowrap}
.acc{color:${dark ? ACCENT_SOFT : ACCENT}}
.pill{display:inline-block;font-family:Inter;font-weight:800;font-size:.34em;line-height:1;padding:.32em .7em;margin:0 .1em;border-radius:999px;
  background:${ACCENT};color:#fff;transform:rotate(-2deg) translateY(-.22em);letter-spacing:.04em;box-shadow:0 10px 30px ${ACCENT}66}
.body{margin-top:34px;max-width:780px;text-align:center;font-size:${o.ratio === "1:1" ? 28 : 31}px;line-height:1.45;font-weight:500;color:var(--muted);position:relative;z-index:4}
.orb{position:absolute;left:50%;top:50%;width:min(76%,72vh);aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;
  background:radial-gradient(circle, var(--ink) 33%, transparent 36%) 0 0/13px 13px;
  -webkit-mask-image:radial-gradient(circle at 35% 30%,#000 20%,rgba(0,0,0,.25) 62%,transparent 71%);box-shadow:0 0 120px ${ACCENT}55}
.orbit{position:absolute;left:50%;top:50%;width:92%;aspect-ratio:3/1;transform:translate(-50%,-50%) rotate(-14deg);border:3px solid ${ACCENT};border-radius:50%;box-shadow:0 0 30px ${ACCENT}}
.frame{position:absolute;border:2px dashed var(--ink);opacity:.8}
.f1{left:12%;top:8%;width:52%;height:62%}
.f2{left:36%;top:30%;width:52%;height:62%;border:3px solid ${ACCENT};border-style:solid;box-shadow:0 0 40px ${ACCENT}55}
.cross{position:absolute;left:62%;top:61%;width:60px;height:60px;transform:translate(-50%,-50%);
  background:linear-gradient(var(--ink),var(--ink)) center/2px 100% no-repeat,linear-gradient(var(--ink),var(--ink)) center/100% 2px no-repeat}
.foot{position:absolute;bottom:60px;left:0;right:0;display:flex;justify-content:center;gap:28px;font-family:'JetBrains Mono';font-size:20px;opacity:.7;z-index:5}
.foot b{color:${dark ? ACCENT_SOFT : ACCENT};font-weight:500}
</style></head><body>
<div class="bg"></div><div class="grid"></div><div class="ghost">${esc(ghost)}</div><div class="grain"></div>
<span class="crop c1"></span><span class="crop c2"></span><span class="crop c3"></span><span class="crop c4"></span>
<div class="top"><div class="logo">${esc(o.brand.split(" ")[0].toUpperCase())}<small>${esc(o.brand.split(" ").slice(1).join(" ").toUpperCase() || "STUDIO")}</small></div><div class="count">${count}</div></div>
<div class="stage">
  ${slide.kicker ? `<div class="kicker">${esc(slide.kicker)}</div>` : ""}
  <div class="hero">${hero}</div>
  <div class="headline">${lines.map((l) => `<div>${l.html}</div>`).join("")}</div>
  ${slide.body ? `<p class="body">${esc(slide.body)}</p>` : ""}
</div>
<div class="foot"><span>${esc(o.handle ?? "@saturnstudio")}</span>${last ? "" : "<b>glisse →</b>"}</div>
</body></html>`;
}

/** Motifs graphiques de repli (sans visuel Gemini), variés d'une slide à l'autre. */
function motif(variant: number): string {
  if (variant === 1) {
    // Sphère en trame + orbite : l'écho « planète / astronaute » des références.
    return `<div class="motif"><div class="orb"></div><div class="orbit"></div><span class="glitch g1"></span></div>`;
  }
  if (variant === 2) {
    // Cadres de sélection façon logiciel + viseur.
    return `<div class="motif"><div class="frame f1"></div><div class="frame f2"></div><div class="cross"></div><span class="glitch g2"></span></div>`;
  }
  return `<div class="motif">
    <div class="band b1"><i></i></div><div class="band b2"><i></i></div><div class="band b3"><i></i></div>
    <span class="glitch g1"></span><span class="glitch g2"></span></div>`;
}

/** Prompt Gemini du visuel héros : sujet isolé sur fond uni (fusionné ensuite). */
export function heroPrompt(visual: string, dark: boolean): string {
  return `${visual}. Single hero subject, centered, full subject visible with some margin. Dramatic studio lighting, high-contrast black and white rendering with a subtle violet neon rim light. Isolated on a pure ${dark ? "black (#000000)" : "white (#FFFFFF)"} seamless background, nothing else in the frame. Photorealistic 3D render, crisp details. No text, no letters, no logos, no watermark.`;
}
