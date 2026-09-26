/**
 * Thème « Poster » des decks PDF — même langage visuel que les carrousels de Léa.
 *
 * Posé PAR-DESSUS le template existant (aucun renderer réécrit) :
 *  - slides d'affirmation (titre, contenu, chiffre, citation, sommaire, fin) en
 *    SOMBRE : lumière violette, grain, mot fantôme géant ;
 *  - slides de données (barres, courbes, matrices, organigrammes…) en CLAIR :
 *    leurs graphiques sont dessinés à l'encre sombre et doivent rester lisibles ;
 *  - titres en Anton capitales, **mot** → accent violet, ==mot== → pastille ;
 *  - repères de recadrage, grille, pied de page en police mono.
 */
const DARK_KINDS = new Set(["title", "content", "stat", "quote", "thanks", "toc"]);
const ACCENT = "#8B3DFF";
const ACCENT_SOFT = "#B98CFF";

function ghostWord(sectionHtml: string): string {
  const m = sectionHtml.match(/<(h1|blockquote)[^>]*>([\s\S]*?)<\/\1>/);
  const text = (m?.[2] ?? "").replace(/<[^>]+>/g, " ").replace(/[*=«»"—]/g, " ").trim();
  const words = text.split(/\s+/).filter((w) => w.length > 2);
  return (words.pop() ?? "").toUpperCase().slice(0, 10);
}

/** Applique le thème à la section HTML d'une slide. */
export function applyPosterTheme(sectionHtml: string, kind: string): string {
  const dark = DARK_KINDS.has(kind);
  const ghost = ghostWord(sectionHtml);
  const deco = `<div class="pz-deco" aria-hidden="true">
    ${dark ? '<div class="pz-glow"></div>' : ""}
    <div class="pz-grid"></div>
    ${ghost ? `<div class="pz-ghost">${ghost}</div>` : ""}
    <div class="pz-grain"></div>
    <span class="pz-crop c1"></span><span class="pz-crop c2"></span><span class="pz-crop c3"></span><span class="pz-crop c4"></span>
  </div>`;
  return sectionHtml
    .replace(/<section class="slide ([^"]*)"([^>]*)>/, `<section class="slide $1 ${dark ? "pz-dark" : "pz-light"}"$2>${deco}`)
    // Palette : les teintes chaudes de l'ancien thème deviennent des violets.
    .replace(/#F57444/gi, ACCENT_SOFT)
    .replace(/#F574AB/gi, "#5B21B6")
    .replace(/#B464D3/gi, ACCENT)
    // Mise en valeur (le texte est déjà échappé : les marqueurs restent littéraux).
    .replace(/\*\*([^*<]+?)\*\*/g, '<span class="pz-acc">$1</span>')
    .replace(/==([^=<]+?)==/g, '<span class="pz-pill">$1</span>')
    .replace(/(^|[\s>(«])[*_]([^*_<\s][^*_<]*?)[*_](?=[\s<.,;:!?)»]|$)/g, '$1<span class="pz-acc">$2</span>');
}

/** Polices du thème : en <link> (un @import placé après d'autres règles serait ignoré). */
export const POSTER_DECK_FONTS =
  '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=JetBrains+Mono:wght@500&display=block">';

export const POSTER_DECK_STYLES = `
body.theme-poster { background: #0B0A0F; }
.theme-poster .slide { background: #E7E6EC; }
.theme-poster .slide.pz-dark { background: #0B0A0F; color: #F4F2F8; }
.theme-poster .gradient-blob { display: none; }

/* Sur fond sombre : tout le texte prend la couleur de la slide (certains
   éléments forcent l'encre sombre), sauf les mises en valeur. */
.theme-poster .slide.pz-dark *:not(.pz-deco):not(.pz-deco *):not(.pz-acc):not(.pz-pill) { color: inherit !important; }

/* Graphiques : segment clair des barres en violet doux (au lieu de l'orange). */
.theme-poster .bar-fill-light { background: ${ACCENT_SOFT} !important; }

/* Décor */
.theme-poster .slide { isolation: isolate; }
.pz-deco { position: absolute; inset: 0; pointer-events: none; z-index: -1; }
.pz-glow { position: absolute; inset: 0;
  background: radial-gradient(55% 60% at 70% 30%, ${ACCENT}55, transparent 70%), radial-gradient(40% 45% at 10% 100%, ${ACCENT}33, transparent 70%); }
.pz-grid { position: absolute; inset: 0; opacity: .35;
  background-image: linear-gradient(rgba(127,127,127,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(127,127,127,.18) 1px, transparent 1px);
  background-size: 96px 96px; -webkit-mask-image: radial-gradient(70% 70% at 50% 45%, #000, transparent); }
.pz-grain { position: absolute; inset: 0; opacity: .14; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence baseFrequency='.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>"); }
.pz-ghost { position: absolute; right: -20px; bottom: -40px; font-family: Anton; font-size: 380px; line-height: .8; white-space: nowrap;
  color: transparent; -webkit-text-stroke: 2px rgba(127,127,127,.18); }
.pz-crop { position: absolute; width: 44px; height: 44px; border: 0 solid rgba(127,127,127,.55); }
.pz-crop.c1 { top: 36px; left: 36px; border-top-width: 2px; border-left-width: 2px; }
.pz-crop.c2 { top: 36px; right: 36px; border-top-width: 2px; border-right-width: 2px; }
.pz-crop.c3 { bottom: 36px; left: 36px; border-bottom-width: 2px; border-left-width: 2px; }
.pz-crop.c4 { bottom: 36px; right: 36px; border-bottom-width: 2px; border-right-width: 2px; }

/* Typographie */
.theme-poster .content-body p, .theme-poster .stat-body, .theme-poster .thanks-body, .theme-poster .title-subtitle {
  text-transform: none !important; font-weight: 500 !important; letter-spacing: 0 !important; line-height: 1.5 !important; }
.theme-poster .content-body p { font-size: 30px !important; max-width: 1100px; opacity: .85; }
.theme-poster .title-hero, .theme-poster .section-title, .theme-poster .stat-value,
.theme-poster .kpi-value, .theme-poster .pillar-num, .theme-poster .toc-num {
  font-family: 'Anton', sans-serif !important; font-weight: 400 !important;
  text-transform: uppercase; letter-spacing: .005em !important; line-height: .92 !important; }
.theme-poster .big-quote { font-family: 'Anton', sans-serif; font-weight: 400; line-height: 1.02; letter-spacing: .005em; }
.theme-poster .title-category, .theme-poster .footer {
  font-family: 'JetBrains Mono', monospace; font-weight: 500; letter-spacing: .14em; }
.theme-poster .pz-light .pz-acc { color: ${ACCENT}; }
.theme-poster .pz-dark .pz-acc { color: ${ACCENT_SOFT}; }
.theme-poster .pz-pill { display: inline-block; font-family: 'Inter', sans-serif; font-weight: 800; font-size: .34em; line-height: 1;
  padding: .32em .7em; margin: 0 .12em; border-radius: 999px; background: ${ACCENT}; color: #fff !important;
  transform: rotate(-2deg) translateY(-.2em); letter-spacing: .04em; text-transform: none; vertical-align: middle; }
`;
