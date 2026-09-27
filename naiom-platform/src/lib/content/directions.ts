/**
 * Les 5 directions artistiques Saturn (Vanguard · Orbit Story · Signal · Grille · Atelier), rendues en HTML → PNG.
 * Texte rendu par le navigateur (100 % fidèle, aucune faute d'IA) ; la mascotte Orbi
 * (poses générées sur Higgsfield puis détourées, cf. scripts/build_mascot.mjs) et le logo
 * font partie de la composition — jamais collés après coup.
 */
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";
import { logoDataUriSync } from "../brand/logo";
import type { Platform, Slide } from "./generate";

export type Direction = "vanguard" | "orbit" | "signal" | "grille" | "atelier";
export const DIRECTIONS: Direction[] = ["vanguard", "orbit", "signal", "grille", "atelier"];

export function directionOf(refId?: string | null): Direction | null {
  const d = refId?.startsWith("da-") ? refId.slice(3) : null;
  return d && (DIRECTIONS as string[]).includes(d) ? (d as Direction) : null;
}

type Pose = "base" | "wave" | "point" | "think" | "hold-ring" | "fly" | "sit" | "peek" | "celebrate";
const MASCOT_DIR = path.join(process.cwd(), "public", "brand", "mascot");
const OUT_DIR = path.join(process.cwd(), "public", "content-out");
const poseCache = new Map<Pose, string>();

/** Pose détourée en data URI ; retombe sur la pose de base si une pose manque. */
function orbi(pose: Pose): string {
  const hit = poseCache.get(pose);
  if (hit) return hit;
  const file = [pose, "base"].map((p) => path.join(MASCOT_DIR, `orbi-${p}-cut.png`)).find((f) => fs.existsSync(f));
  const uri = file ? `data:image/png;base64,${fs.readFileSync(file).toString("base64")}` : "";
  poseCache.set(pose, uri);
  return uri;
}

// Accent unique Saturn (aligné sur --color-primary) + dégradé néon de Signal.
const VIOLET = "#7C3AED";
const VIOLET_LIGHT = "#A78BFA";
const NEON = "linear-gradient(100deg,#7C3AED 0%,#C026D3 45%,#FB923C 100%)";

const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const pad = (n: number) => String(n).padStart(2, "0");

/** Retire l'emphase markdown et colle la ponctuation isolée (« vite ? ») à son mot. */
const glue = (t: string) => String(t ?? "").replace(/\*/g, "").trim().replace(/ +([?!:;»])/g, " $1");

/** Sépare le titre en « tête » + « chute » (derniers mots mis en valeur). */
function splitTitle(t: string): [string, string] {
  const w = glue(t).split(/ +/);
  if (w.length < 3) return ["", w.join(" ")];
  const n = w.length > 6 ? 2 : 1;
  return [w.slice(0, -n).join(" "), w.slice(-n).join(" ")];
}

/**
 * Plus grande taille de titre qui tient dans `width` en `lines` lignes max.
 * `em` = largeur moyenne d'un caractère en em pour la police utilisée.
 */
function fit(text: string, width: number, lines: number, em: number, max: number, min = 48): number {
  const t = String(text ?? "").replace(/\*/g, "").trim();
  const longest = Math.max(1, ...t.split(/\s+/).map((w) => w.length));
  let px = Math.min(max, width / (longest * em));
  while (px > min && Math.ceil((t.length * em * px) / width) > lines) px -= 4;
  return Math.round(Math.max(min, px));
}

interface Ctx { i: number; total: number; W: number; H: number; single: boolean }
const role = (c: Ctx) => (c.single || c.i === 0 ? "cover" : c.i === c.total - 1 ? "end" : "content");

const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,800;1,900&family=Instrument+Serif:ital@0;1&family=Archivo:wght@500;700;800;900&family=Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@400;600&family=Inter:wght@400;500;600;700&family=Caveat:wght@600;700&display=swap" rel="stylesheet">`;
/**
 * Ajustement anti-chevauchement, exécuté dans la page une fois les polices chargées.
 * Les textes réels sont de longueur imprévisible : on mesure puis, dans l'ordre,
 *  1. on réduit les titres qui débordent en largeur ;
 *  2. pour chaque mascotte [data-m] (ancrée par le bas) : on la cale au-dessus de
 *     [data-above], on la descend jusqu'à data-minbottom, puis on la rétrécit ;
 *  3. en dernier recours on réduit le texte, jusqu'à ce que plus rien ne se touche.
 * Zones de texte = [data-txt] ; parties mesurées d'une mascotte = [data-core].
 */
const FIT_SCRIPT = `<script>
window.__fit = function () {
  var S = document.querySelector('.s'), H = S.offsetHeight, GAP = 22;
  var txt = [].slice.call(document.querySelectorAll('[data-txt]'));
  var ms = [].slice.call(document.querySelectorAll('[data-m]'));
  function hit(a, b) { return a.left < b.right + GAP && a.right + GAP > b.left && a.top < b.bottom + GAP && a.bottom + GAP > b.top; }
  function parts(m) { return (m.tagName === 'IMG' || m.hasAttribute('data-self')) ? [m] : [].slice.call(m.querySelectorAll('[data-core]')); }
  function overlaps(m) { return parts(m).some(function (p) { var r = p.getBoundingClientRect(); return txt.some(function (t) { return hit(r, t.getBoundingClientRect()); }); }); }
  function shrink(els, f) { els.forEach(function (e) { e.style.fontSize = (parseFloat(getComputedStyle(e).fontSize) * f) + 'px'; }); }
  function textEls() { var out = []; txt.forEach(function (t) { out = out.concat([].slice.call(t.querySelectorAll('h1,h2,p,.it,.sub,.script,.kick'))); }); return out; }
  txt.forEach(function (t) { [].slice.call(t.querySelectorAll('h1,h2')).forEach(function (h) {
    var k = 0; while (h.scrollWidth > h.clientWidth + 2 && k++ < 30) shrink([h].concat([].slice.call(h.querySelectorAll('.it'))), 0.95);
  }); });
  var k, i;
  for (i = 0; i < txt.length; i++) for (var j = i + 1; j < txt.length; j++) {
    k = 0; while (hit(txt[i].getBoundingClientRect(), txt[j].getBoundingClientRect()) && k++ < 14) shrink(textEls(), 0.95);
  }
  ms.forEach(function (m) {
    m.style.transformOrigin = 'bottom center';
    if (m.dataset.above) { var a = document.querySelector(m.dataset.above); if (a) { m.style.top = 'auto'; m.style.bottom = (H - a.getBoundingClientRect().top + 18) + 'px'; } }
    if (m.dataset.minbottom !== undefined) {
      var min = +m.dataset.minbottom; k = 0;
      while (overlaps(m) && k++ < 200) { var b = parseFloat(getComputedStyle(m).bottom); if (b <= min) break; m.style.bottom = Math.max(min, b - 8) + 'px'; }
    }
    var s = 1;
    while (!m.hasAttribute('data-noscale') && overlaps(m) && s > 0.5) { s -= 0.04; m.style.scale = String(s); }
    k = 0; while (overlaps(m) && k++ < 14) shrink(textEls(), 0.95);
  });
  return true;
};
</script>`;

const doc = (css: string, body: string, c: Ctx) =>
  `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>*{box-sizing:border-box;margin:0;padding:0}html,body{width:${c.W}px;height:${c.H}px;overflow:hidden}.s{position:relative;width:${c.W}px;height:${c.H}px;overflow:hidden}${css}</style>${FIT_SCRIPT}</head><body><div class="s">${body}</div></body></html>`;

/* ======================= 1. VANGUARD — minimaliste ======================= */
function vanguard(s: Slide, c: Ctx): string {
  const r = role(c);
  const logo = logoDataUriSync("black");
  const title = esc(glue(s.title));
  const body = esc(s.body ?? "");
  const horizon = Math.round(c.H * (r === "content" ? 0.8 : r === "end" ? 0.74 : 0.7));
  const meta = `<div class="meta"><img src="${logo}" class="lg"><span>${c.single ? "SATURN STUDIO" : `${pad(c.i + 1)} / ${pad(c.total)}`}</span><span>@saturn.agency</span></div>`;
  // Ligne d'horizon traversée par l'anneau du logo, avec Orbi posé dessus : un seul groupe,
  // ancré par le bas, que l'ajustement peut faire descendre si le texte est long.
  const horizonGroup = (pose: Pose, mh: number, x: number, minBottom: number) =>
    `<div data-m data-noscale data-minbottom="${minBottom}" style="position:absolute;left:0;width:${c.W}px;height:${mh + 134}px;bottom:${c.H - horizon - 70}px">
      <img data-core class="orbi" src="${orbi(pose)}" style="height:${mh}px;left:${x}px;bottom:64px">
      <svg data-core class="orb" style="bottom:0" width="${c.W}" height="140" viewBox="0 0 ${c.W} 140"><line x1="0" y1="70" x2="${c.W}" y2="70" stroke="#0A0A0A" stroke-width="2"/><ellipse cx="${c.W * 0.5}" cy="70" rx="${c.W * 0.34}" ry="46" fill="none" stroke="${VIOLET}" stroke-width="2.5" transform="rotate(-6 ${c.W * 0.5} 70)"/></svg>
    </div>`;
  const css = `.s{background:#F4F3EF;color:#0A0A0A;font-family:Inter,sans-serif}
  .meta{position:absolute;top:56px;left:64px;right:64px;display:flex;justify-content:space-between;align-items:center;font:600 20px/1 'JetBrains Mono',monospace;letter-spacing:.14em;text-transform:uppercase}
  .lg{height:34px;width:auto}
  .orb{position:absolute;left:0}
  .t{font-family:'Barlow Condensed',sans-serif;font-style:italic;font-weight:900;text-transform:uppercase;letter-spacing:-.01em;line-height:.86}
  .kick{font:700 22px/1.3 'JetBrains Mono',monospace;letter-spacing:.2em;text-transform:uppercase;color:${VIOLET}}
  .p{font-size:34px;line-height:1.35;color:#3F3F46;max-width:${c.W - 200}px}
  .orbi{position:absolute;filter:drop-shadow(0 18px 18px rgba(0,0,0,.18))}
  .num{font:900 italic 240px/1 'Barlow Condensed',sans-serif;color:transparent;-webkit-text-stroke:2px #0A0A0A;position:absolute;right:56px;top:110px;opacity:.9}`;
  let inner = "";
  if (r === "cover") {
    const size = fit(title, c.W - 128, 4, 0.5, 230);
    inner = `<div data-txt style="position:absolute;left:64px;right:64px;top:${Math.round(c.H * 0.17)}px">
      <div class="kick">${body || "Saturn Studio"}</div>
      <h1 class="t" style="font-size:${size}px;margin-top:28px">${title}</h1></div>
      ${horizonGroup("wave", Math.round(c.H * 0.16), Math.round(c.W * 0.78), 120)}
      <div data-txt class="kick" style="position:absolute;left:64px;bottom:64px;color:#0A0A0A">Swipe →</div>`;
  } else if (r === "content") {
    const size = fit(title, c.W - 128, 3, 0.5, 150);
    inner = `<div class="num">${pad(c.i + 1)}</div>
      <div data-txt style="position:absolute;left:64px;right:64px;top:${Math.round(c.H * 0.3)}px">
      <h2 class="t" style="font-size:${size}px">${title}</h2>
      ${body ? `<p class="p" style="margin-top:36px">${body}</p>` : ""}</div>
      ${horizonGroup(c.i % 2 ? "think" : "point", Math.round(c.H * 0.1), c.i % 2 ? 80 : c.W - 200, 10)}`;
  } else {
    inner = `<div data-txt style="position:absolute;left:80px;right:80px;top:${Math.round(c.H * 0.17)}px;display:flex;flex-direction:column;align-items:center;text-align:center;gap:36px">
      <h2 class="t" style="font-size:${fit(title, c.W - 160, 3, 0.5, 190)}px">${title}</h2>
      ${body ? `<p class="p">${body}</p>` : ""}</div>
      <img data-txt src="${logo}" style="position:absolute;height:72px;width:auto;left:50%;transform:translateX(-50%);bottom:64px">
      ${horizonGroup("celebrate", Math.round(c.H * 0.14), Math.round(c.W / 2 - c.H * 0.06), 160)}`;
  }
  return doc(css, meta + inner, c);
}

/* ======================= 2. ORBIT STORY — narratif ======================= */
function orbitStory(s: Slide, c: Ctx): string {
  const r = role(c);
  const logo = logoDataUriSync("white");
  const [head, tail] = splitTitle(s.title);
  const body = esc(s.body ?? "");
  const left = c.i % 2 === 1; // la mascotte change de côté à chaque slide
  const poses: Pose[] = ["point", "think", "sit", "peek", "fly"];
  const pose: Pose = r === "cover" ? "wave" : r === "end" ? "hold-ring" : poses[(c.i - 1) % poses.length];
  // Trajectoire d'orbite continue : l'arc sort d'un bord et entre par l'autre à la slide suivante.
  const shift = (c.i % 2 ? -1 : 1) * c.W * 0.35;
  const stars = Array.from({ length: 36 }, (_, k) => {
    const x = (k * 283 + c.i * 97) % c.W, y = (k * 431 + c.i * 53) % c.H, o = 0.15 + ((k * 7) % 10) / 22;
    return `<circle cx="${x}" cy="${y}" r="${k % 5 ? 1.4 : 2.4}" fill="#fff" opacity="${o.toFixed(2)}"/>`;
  }).join("");
  const css = `.s{background:radial-gradient(120% 90% at ${left ? "20%" : "80%"} 70%,#2A1650 0%,#110A22 45%,#06050B 100%);color:#fff;font-family:Inter,sans-serif}
  .bg{position:absolute;inset:0}
  .top{position:absolute;top:56px;left:64px;right:64px;display:flex;justify-content:space-between;align-items:center;font:500 20px/1 'JetBrains Mono',monospace;letter-spacing:.16em;text-transform:uppercase;color:${VIOLET_LIGHT}}
  .lg{height:34px;width:auto}
  .h{font-family:Archivo,sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:-.02em;line-height:.95}
  .it{display:block;font-family:'Instrument Serif',serif;font-style:italic;font-weight:400;text-transform:none;letter-spacing:-.01em;line-height:.95;color:${VIOLET_LIGHT}}
  .p{font-size:32px;line-height:1.4;color:rgba(255,255,255,.78)}
  .orbi{position:absolute;filter:drop-shadow(0 0 40px rgba(167,139,250,.45)) drop-shadow(0 30px 30px rgba(0,0,0,.5))}
  .dots{position:absolute;bottom:62px;left:64px;display:flex;gap:10px}
  .dots i{width:10px;height:10px;border-radius:50%;background:rgba(255,255,255,.25)}.dots i.on{background:${VIOLET_LIGHT};width:34px;border-radius:6px}`;
  const orbitSvg = `<svg class="bg" viewBox="0 0 ${c.W} ${c.H}"><g>${stars}</g>
    <ellipse cx="${c.W / 2 + shift}" cy="${c.H * 0.62}" rx="${c.W * 0.9}" ry="${c.H * 0.2}" fill="none" stroke="${VIOLET_LIGHT}" stroke-opacity=".35" stroke-width="2" stroke-dasharray="2 14" transform="rotate(-12 ${c.W / 2} ${c.H * 0.62})"/>
    <ellipse cx="${c.W / 2 + shift}" cy="${c.H * 0.62}" rx="${c.W * 0.7}" ry="${c.H * 0.14}" fill="none" stroke="${VIOLET}" stroke-opacity=".5" stroke-width="1.5" transform="rotate(-12 ${c.W / 2} ${c.H * 0.62})"/></svg>`;
  const chapter = c.single ? "Saturn Studio" : r === "cover" ? "Un récit d'Orbi" : r === "end" ? "Fin du chapitre" : `Chapitre ${pad(c.i)}`;
  const top = `<div class="top"><img src="${logo}" class="lg"><span>${chapter}</span></div>`;
  const dots = c.single ? "" : `<div class="dots">${Array.from({ length: c.total }, (_, k) => `<i class="${k === c.i ? "on" : ""}"></i>`).join("")}</div>`;
  // Archivo 900 en capitales est large (~0,7 em par caractère).
  const size = fit(`${head} ${tail}`, r === "end" ? c.W - 160 : c.W * 0.6, 4, 0.7, r === "cover" ? 120 : 96);
  const mh = Math.round(c.H * (r === "content" ? 0.42 : 0.5));
  let inner: string;
  if (r === "end") {
    // Révélation du logo au-dessus d'Orbi, qui brandit l'anneau ; la pose est posée
    // sur le bord bas de la slide (l'image source est coupée en bas).
    inner = `<div data-txt style="position:absolute;left:80px;right:80px;top:${Math.round(c.H * 0.1)}px;text-align:center">
      <img src="${logo}" style="height:72px;width:auto;margin:0 auto 34px;display:block;filter:drop-shadow(0 0 24px rgba(167,139,250,.6))">
      <h2 class="h" style="font-size:${size}px">${esc(head)} <span class="it" style="font-size:${Math.round(size * 1.25)}px">${esc(tail)}</span></h2>
      ${body ? `<p class="p" style="margin-top:28px">${body}</p>` : ""}</div>
      <img data-m class="orbi" src="${orbi(pose)}" style="height:${mh}px;left:${Math.round(c.W / 2 - mh * 0.3)}px;bottom:0">`;
  } else {
    const textBox = left ? `right:64px;left:${Math.round(c.W * 0.36)}px` : `left:64px;right:${Math.round(c.W * 0.36)}px`;
    inner = `<div data-txt style="position:absolute;${textBox};top:${Math.round(c.H * (r === "cover" ? 0.18 : 0.2))}px">
      <h2 class="h" style="font-size:${size}px">${esc(head)} <span class="it" style="font-size:${Math.round(size * 1.3)}px">${esc(tail)}</span></h2>
      ${body ? `<p class="p" style="margin-top:32px">${body}</p>` : ""}</div>
      <img data-m class="orbi" src="${orbi(pose)}" style="height:${mh}px;${left ? "left:40px" : "right:40px"};bottom:${Math.round(c.H * 0.08)}px">`;
  }
  return doc(css, orbitSvg + top + inner + dots, c);
}

/* ======================= 3. SIGNAL — tactile / immersif ======================= */
function signal(s: Slide, c: Ctx): string {
  const r = role(c);
  const logo = logoDataUriSync("white");
  const [head, tail] = splitTitle(s.title);
  const body = esc(s.body ?? "");
  const pose: Pose = r === "cover" ? "fly" : r === "end" ? "celebrate" : (["point", "think", "peek", "fly"] as Pose[])[(c.i - 1) % 4];
  const size = fit(`${head} ${tail}`, c.W - 120, r === "cover" ? 4 : 3, 0.52, r === "cover" ? 190 : 140);
  const mh = Math.round(c.H * (r === "cover" ? 0.38 : 0.28));
  const blobX = r === "content" && c.i % 2 ? "15%" : "85%";
  const css = `.s{background:#050507;color:#fff;font-family:Inter,sans-serif}
  .blob{position:absolute;inset:-20%;background:radial-gradient(40% 35% at ${blobX} 72%,rgba(124,58,237,.85),transparent 70%),radial-gradient(35% 30% at ${blobX === "85%" ? "30%" : "70%"} 88%,rgba(251,146,60,.55),transparent 70%),radial-gradient(30% 25% at 50% 20%,rgba(192,38,211,.25),transparent 70%);filter:blur(30px)}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:54px 54px}
  .grain{position:absolute;inset:0;opacity:.22;mix-blend-mode:overlay}
  .hud{position:absolute;top:52px;left:60px;right:60px;display:flex;justify-content:space-between;align-items:center;font:500 19px/1 'JetBrains Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.7)}
  .rec{display:inline-flex;align-items:center;gap:10px}.rec b{width:12px;height:12px;border-radius:50%;background:#FB923C;box-shadow:0 0 14px #FB923C}
  .lg{height:34px;width:auto}
  .h{font-family:'Space Grotesk',sans-serif;font-weight:700;letter-spacing:-.045em;line-height:.92;position:relative}
  .g{background:${NEON};-webkit-background-clip:text;background-clip:text;color:transparent}
  .ghost{position:absolute;inset:0;filter:blur(14px);opacity:.55;transform:translateX(-26px)}
  .glass{position:absolute;left:60px;right:60px;bottom:64px;border-radius:30px;padding:30px 34px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);backdrop-filter:blur(18px);display:flex;gap:26px;align-items:center}
  .glass p{flex:1;font-size:29px;line-height:1.4;color:rgba(255,255,255,.88)}
  .go{flex:none;width:74px;height:74px;border-radius:22px;background:${NEON};display:flex;align-items:center;justify-content:center;font:700 34px/1 Inter;color:#fff;box-shadow:0 0 30px rgba(192,38,211,.6)}
  .tag{font:600 20px/1 'JetBrains Mono',monospace;letter-spacing:.2em;text-transform:uppercase;color:#FB923C}
  .orbi{position:absolute;filter:drop-shadow(0 0 34px rgba(124,58,237,.9)) drop-shadow(0 0 80px rgba(192,38,211,.5))}
  .trail{position:absolute;filter:blur(10px);opacity:.35}`;
  const grain = `<svg class="grain" width="${c.W}" height="${c.H}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;
  const tagText = c.single ? "Signal" : r === "cover" ? "Signal entrant" : r === "end" ? "Fin de transmission" : `Signal_${pad(c.i + 1)}`;
  const hud = `<div class="hud"><img src="${logo}" class="lg"><span>${tagText}</span><span class="rec"><b></b>${c.single ? "LIVE" : `${pad(c.i + 1)}/${pad(c.total)}`}</span></div>`;
  const titleHtml = (px: number) => `<h2 class="h" style="font-size:${px}px"><span class="ghost">${esc(head)} <span class="g">${esc(tail)}</span></span>${esc(head)} <span class="g">${esc(tail)}</span></h2>`;
  // Traînées de vitesse derrière Orbi : copies floutées décalées.
  const mascot = (x: string, h: number, p: Pose) => {
    const src = orbi(p);
    // Groupe ancré juste au-dessus de la barre en verre (data-above), rétréci si le titre descend.
    return `<div data-m data-above=".glass" style="position:absolute;${x};bottom:0;height:${h}px;width:${Math.round(h * 0.9)}px">
      <img class="trail" src="${src}" style="height:100%;left:0;bottom:0;transform:translate(60px,40px)">
      <img class="trail" src="${src}" style="height:100%;left:0;bottom:0;transform:translate(120px,80px);opacity:.18">
      <img data-core class="orbi" src="${src}" style="height:100%;left:0;bottom:0">
    </div>`;
  };
  let inner: string;
  if (r === "end") {
    inner = `<div data-txt style="position:absolute;left:60px;right:60px;top:${Math.round(c.H * 0.12)}px;display:flex;flex-direction:column;align-items:center;gap:30px;text-align:center">
      <img src="${logo}" style="height:120px;width:auto;filter:drop-shadow(0 0 30px rgba(167,139,250,.9))">
      ${titleHtml(size)}</div>
      ${mascot(`left:${Math.round(c.W / 2 - mh * 0.4)}px`, Math.round(mh * 0.85), pose)}
      <div data-txt class="glass"><p>${body || "Suis Saturn Studio pour la suite."}</p><div class="go">→</div></div>`;
  } else {
    const mx = r === "cover" ? `right:${Math.round(c.W * 0.06)}px` : c.i % 2 ? `left:40px` : `right:40px`;
    inner = `<div data-txt style="position:absolute;left:60px;right:60px;top:${Math.round(c.H * 0.14)}px">
      <div class="tag">${r === "cover" ? "// Saturn Studio" : `// ${pad(c.i + 1)}`}</div>
      <div style="margin-top:26px">${titleHtml(size)}</div></div>
      ${mascot(mx, mh, pose)}
      <div data-txt class="glass"><p>${body || "Swipe pour décoder le signal."}</p><div class="go">→</div></div>`;
  }
  return doc(css, `<div class="blob"></div><div class="grid"></div>${grain}${hud}${inner}`, c);
}

/* ======================= 4. GRILLE — papier millimétré éditorial ======================= */
function grille(s: Slide, c: Ctx): string {
  const r = role(c);
  const logo = logoDataUriSync("black");
  const [head, tail] = splitTitle(s.title);
  const body = esc(s.body ?? "");
  const css = `.s{background:#ECEAE3;color:#141414;font-family:Inter,sans-serif}
  .grid{position:absolute;inset:0;background-image:linear-gradient(rgba(20,20,20,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(20,20,20,.07) 1px,transparent 1px);background-size:36px 36px}
  .grain{position:absolute;inset:0;opacity:.28;mix-blend-mode:multiply}
  .top{position:absolute;top:56px;left:64px;right:64px;display:flex;justify-content:space-between;align-items:center;font:500 24px/1 Inter,sans-serif;color:#55534D}
  .lg{height:34px;width:auto}
  .h{font-family:'Instrument Serif',serif;font-weight:400;letter-spacing:-.025em;line-height:.95;color:#141414}
  .h em{font-style:normal;color:${VIOLET}}
  .sub{font:700 40px/1.2 Archivo,sans-serif;color:#2B2A27;letter-spacing:-.01em}
  .p{font-size:32px;line-height:1.42;color:#3A3934}
  .num{display:inline-flex;align-items:center;justify-content:center;height:52px;padding:0 20px;border:2px solid ${VIOLET};border-radius:26px;font:600 22px/1 'JetBrains Mono',monospace;color:${VIOLET};letter-spacing:.1em}
  .card{position:absolute;left:64px;right:64px;border-radius:30px;background:#0C0B12;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.18)}
  .card::after{content:"";position:absolute;inset:0;background:radial-gradient(60% 70% at 50% 100%,rgba(124,58,237,.45),transparent 70%)}
  .foot{position:absolute;left:64px;right:64px;bottom:52px;display:flex;justify-content:space-between;align-items:center}
  .who{display:flex;align-items:center;gap:16px;font:500 22px/1.25 Inter;color:#55534D}
  .who b{display:block;font-weight:700;font-size:25px;color:#141414}
  .av{width:70px;height:70px;border-radius:50%;background-color:#0C0B12;background-position:center 12%;background-size:150% auto;background-repeat:no-repeat;border:3px solid ${VIOLET}}
  .save{display:flex;align-items:center;gap:12px;font:700 22px/1 Inter;letter-spacing:.06em;text-transform:uppercase}`;
  const grain = `<svg class="grain" width="${c.W}" height="${c.H}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;
  const top = `<div class="top"><img src="${logo}" class="lg"><span>${c.single ? "saturn.agency" : `${pad(c.i + 1)} — ${pad(c.total)}`}</span></div>`;
  const foot = `<div class="foot"><div data-txt class="who"><span class="av" style="background-image:url(${orbi("base")})"></span><span><b>Saturn Studio</b>@saturn.agency</span></div>
    <div data-txt class="save"><svg width="26" height="32" viewBox="0 0 26 32"><path d="M2 2h22v28l-11-8-11 8z" fill="#141414"/></svg>${r === "end" ? "Suivre" : "À enregistrer"}</div></div>`;
  // Grille met en valeur le PREMIER mot en violet (comme « AI » dans « AI Tools »).
  const words = `${head} ${tail}`.trim().split(/ +/);
  const t = `<em>${esc(words[0])}</em> ${esc(words.slice(1).join(" "))}`;
  let inner: string;
  if (r === "cover" || r === "end") {
    const size = fit(`${head} ${tail}`, c.W - 140, 3, 0.42, 170);
    const mh = Math.round(c.H * 0.4);
    inner = `<div data-txt style="position:absolute;left:70px;right:70px;top:${Math.round(c.H * 0.12)}px;text-align:center">
      <h1 class="h" style="font-size:${size}px">${t}</h1>
      ${body ? `<p class="sub" style="margin-top:30px">${body}</p>` : ""}</div>
      <img data-m src="${orbi(r === "end" ? "celebrate" : "base")}" style="position:absolute;height:${mh}px;left:50%;transform:translateX(-50%);bottom:${Math.round(c.H * 0.095)}px;filter:drop-shadow(0 30px 40px rgba(0,0,0,.25))">`;
  } else {
    const size = fit(`${head} ${tail}`, c.W - 128, 3, 0.42, 120);
    const ch = Math.round(c.H * 0.36);
    inner = `<div data-txt style="position:absolute;left:64px;right:64px;top:${Math.round(c.H * 0.12)}px">
      <span class="num">ÉTAPE ${pad(c.i)}</span>
      <h2 class="h" style="font-size:${size}px;margin-top:30px">${t}</h2>
      ${body ? `<p class="p" style="margin-top:26px">${body}</p>` : ""}</div>
      <div data-m data-self class="card" style="height:${ch}px;bottom:${Math.round(c.H * 0.14)}px">
        <img src="${orbi((["point", "think", "sit", "peek"] as Pose[])[(c.i - 1) % 4])}" style="position:absolute;z-index:1;height:${Math.round(ch * 0.86)}px;left:50%;transform:translateX(-50%);bottom:0;filter:drop-shadow(0 0 30px rgba(167,139,250,.5))">
      </div>`;
  }
  return doc(css, `<div class="grid"></div>${grain}${top}${inner}${foot}`, c);
}

/* ======================= 5. ATELIER — papier texturé, dégradé, manuscrit ======================= */
function atelier(s: Slide, c: Ctx): string {
  const r = role(c);
  const logo = logoDataUriSync("black");
  // La 2e ligne (dégradé violet) prend les 2 derniers mots pour éviter un mot orphelin au-dessus.
  const words = glue(s.title).split(/ +/);
  const cut = words.length >= 4 ? words.length - 2 : words.length - 1;
  const head = words.slice(0, cut).join(" "), tail = words.slice(cut).join(" ");
  const body = esc(s.body ?? "");
  const css = `.s{background:radial-gradient(90% 70% at 50% 45%,#F6F3EE 0%,#E6E1D8 100%);color:#141414;font-family:Inter,sans-serif}
  .grain{position:absolute;inset:0;opacity:.45;mix-blend-mode:multiply}
  .by{position:absolute;top:58px;left:0;right:0;display:flex;justify-content:center}
  .lg{height:36px;width:auto}
  .h{font-family:Archivo,sans-serif;font-weight:800;letter-spacing:-.05em;line-height:.9;text-align:center}
  .h .a{background:linear-gradient(180deg,#141414 30%,#3B2A6B 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
  .h .b{display:block;background:linear-gradient(90deg,#5B21B6,#A78BFA);-webkit-background-clip:text;background-clip:text;color:transparent;font-size:.72em;letter-spacing:-.04em;margin-top:.08em;padding-bottom:.08em}
  .script{font:700 46px/1.1 Caveat,cursive;color:#6B5E86;display:flex;align-items:center;justify-content:center;gap:14px}
  .p{font-size:31px;line-height:1.42;color:#3A3934;text-align:center}
  .orbi{position:absolute;filter:drop-shadow(0 34px 34px rgba(40,20,80,.3))}
  .float{position:absolute;filter:blur(9px);opacity:.9}`;
  const grain = `<svg class="grain" width="${c.W}" height="${c.H}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`;
  const arrow = `<svg width="120" height="40" viewBox="0 0 120 40"><path d="M4 26 C 30 10, 60 34, 104 16" fill="none" stroke="#6B5E86" stroke-width="3" stroke-linecap="round"/><path d="M92 8 L106 16 L94 26" fill="none" stroke="#6B5E86" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  // Orbi flous au premier plan (profondeur de champ), coupés par les bords comme les touches de « Cheat codes ».
  const floats = ([["fly", -0.06, 0.05, 0.2, -18], ["peek", 0.86, 0.3, 0.14, 14], ["sit", -0.03, 0.74, 0.16, 8], ["wave", 0.88, 0.8, 0.12, -10]] as [Pose, number, number, number, number][])
    .map(([p, x, y, h, rot], k) => `<img class="float" src="${orbi(p)}" style="height:${Math.round(c.H * h)}px;left:${Math.round(c.W * x)}px;top:${Math.round(c.H * y)}px;transform:rotate(${rot}deg);${k % 2 ? "filter:blur(5px);opacity:.75" : ""}">`)
    .join("");
  const size = fit(`${head} ${tail}`, c.W - 140, 3, 0.5, r === "content" ? 116 : 150);
  const titleHtml = `<h1 class="h" style="font-size:${size}px">${head ? `<span class="a">${esc(head)}</span><span class="b">${esc(tail)}</span>` : `<span class="a">${esc(tail)}</span>`}</h1>`;
  const note = r === "cover" ? (body || "swipe, c'est cadeau") : r === "end" ? "on en parle ?" : `étape ${c.i}`;
  const scriptHtml = `<div class="script">(${esc(note)})${r === "end" ? "" : arrow}</div>`;
  const pose: Pose = r === "cover" ? "wave" : r === "end" ? "hold-ring" : (["think", "point", "sit"] as Pose[])[(c.i - 1) % 3];
  const mh = Math.round(c.H * (r === "content" ? 0.3 : 0.38));
  const inner = `<div class="by"><img src="${logo}" class="lg"></div>
    <div data-txt style="position:absolute;left:70px;right:70px;top:${Math.round(c.H * 0.13)}px;display:flex;flex-direction:column;align-items:center;gap:26px">
      ${titleHtml}${scriptHtml}${r !== "cover" && body ? `<p class="p">${body}</p>` : ""}</div>
    <img data-m class="orbi" src="${orbi(pose)}" style="height:${mh}px;left:50%;transform:translateX(-50%);${r === "end" ? "bottom:0" : `bottom:${Math.round(c.H * 0.07)}px`}">
    <div style="position:absolute;right:64px;bottom:52px;font:600 20px/1 'JetBrains Mono',monospace;letter-spacing:.12em;color:#6B5E86">${c.single ? "" : `${pad(c.i + 1)}/${pad(c.total)}`}</div>`;
  return doc(css, `${grain}${floats}${inner}`, c);
}

const RENDER: Record<Direction, (s: Slide, c: Ctx) => string> = { vanguard, orbit: orbitStory, signal, grille, atelier };

export function directionSlideHTML(d: Direction, s: Slide, c: Ctx): string {
  return RENDER[d](s, c);
}

export function sizeFor(platform: Platform, single: boolean): { W: number; H: number } {
  return platform === "instagram" || !single ? { W: 1080, H: 1350 } : { W: 1080, H: 1080 };
}

/** Rend toutes les slides d'un post dans la direction choisie → URLs publiques des PNG. */
export async function composeDirection(postId: string, platform: Platform, slides: Slide[], d: Direction): Promise<string[]> {
  const single = slides.length === 1;
  const { W, H } = sizeFor(platform, single);
  await fsp.mkdir(OUT_DIR, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] });
  const urls: string[] = [];
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
    for (let i = 0; i < slides.length; i++) {
      await page.setContent(directionSlideHTML(d, slides[i], { i, total: slides.length, W, H, single }), { waitUntil: "load", timeout: 60000 });
      await Promise.race([
        page.evaluate(() => (document as Document & { fonts: FontFaceSet }).fonts.ready.then(() => true)),
        new Promise((r) => setTimeout(r, 5000)),
      ]).catch(() => {});
      await page.evaluate(() => (window as unknown as { __fit?: () => boolean }).__fit?.()).catch(() => {});
      await new Promise((r) => setTimeout(r, 150));
      const file = `${postId}-${d}-${i}.png`;
      await page.screenshot({ path: path.join(OUT_DIR, file) });
      urls.push(`/content-out/${file}?v=${Date.now()}`);
    }
  } finally {
    await browser.close();
  }
  return urls;
}
