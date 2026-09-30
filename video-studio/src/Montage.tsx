/**
 * Montage Saturn : enchaîne les segments choisis par Fatou, avec transitions, textes animés,
 * logo, Orbi et écran de fin, selon le style (rapide, informatif, suspense, humour).
 */
import React from "react";
import {
  AbsoluteFill, Easing, Img, interpolate, Sequence, spring, staticFile, useCurrentFrame, useVideoConfig,
} from "remotion";
import { Video } from "@remotion/media";
import { loadFont as loadArchivo } from "@remotion/google-fonts/Archivo";
import { loadFont as loadSerif } from "@remotion/google-fonts/InstrumentSerif";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { segFrames, STYLE_SPEC, type MontageProps, type Segment, type Style } from "./types";

const { fontFamily: ARCHIVO } = loadArchivo("normal", { weights: ["500", "800", "900"], subsets: ["latin", "latin-ext"] });
const { fontFamily: SERIF } = loadSerif("italic", { subsets: ["latin", "latin-ext"] });
const { fontFamily: HAND } = loadCaveat("normal", { weights: ["700"], subsets: ["latin", "latin-ext"] });

const VIOLET = "#7C3AED";
const VIOLET_LIGHT = "#A78BFA";
const LIME = "#C6FF3D";

/** Unité de mise à l'échelle : 1 = 1080 px sur le plus petit côté. */
function useU() {
  const { width, height } = useVideoConfig();
  return Math.min(width, height) / 1080;
}

/* ---------------- segment vidéo + transition d'entrée ---------------- */
const Clip: React.FC<{ s: Segment; style: Style; index: number; frames: number }> = ({ s, style, index, frames }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const spec = STYLE_SPEC[style];
  const t = interpolate(frame, [0, spec.enter], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });

  let transform = "";
  let opacity = 1;
  let filter = "";
  if (style === "rapide") {
    // Coup de zoom à chaque plan, alterné, plus fort sur les moments clés.
    const punch = s.emphasis ? 0.16 : 0.09;
    transform = `scale(${1 + punch * (1 - t) + (index % 2 ? 0.04 : 0)})`;
  } else if (style === "informatif") {
    opacity = index === 0 ? 1 : t;
    transform = `scale(${1.02 + 0.02 * (frame / frames)})`;
  } else if (style === "suspense") {
    // Lente poussée vers l'avant, fondus au noir, image désaturée.
    opacity = Math.min(t, interpolate(frame, [frames - spec.enter, frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
    transform = `scale(${1 + 0.1 * (frame / frames)})`;
    filter = "saturate(0.7) contrast(1.12)";
  } else {
    // Humour : arrivée en « whip » latéral, léger rebond.
    const dir = index % 2 ? -1 : 1;
    transform = index === 0 ? "" : `translateX(${dir * width * (1 - t)}px) rotate(${dir * 2 * (1 - t)}deg)`;
    filter = index === 0 ? "" : `blur(${(1 - t) * 14}px)`;
  }
  const volume = spec.overlap ? interpolate(frame, [0, spec.overlap], [index === 0 ? 1 : 0, 1], { extrapolateRight: "clamp" }) : 1;

  // Recadrage « cover » calculé : on décale l'image pour garder le sujet (focusX) dans le cadre.
  const frameAspect = width / height;
  const box = s.aspect > frameAspect
    ? { h: height, w: height * s.aspect, left: (width - height * s.aspect) * s.focusX, top: 0 }
    : { w: width, h: width / s.aspect, left: 0, top: (height - width / s.aspect) / 2 };

  return (
    <AbsoluteFill style={{ opacity, overflow: "hidden", backgroundColor: "#000" }}>
      <AbsoluteFill style={{ transform, filter }}>
        <div style={{ position: "absolute", left: box.left, top: box.top, width: box.w, height: box.h }}>
          <Video
            src={/^https?:/.test(s.src) ? s.src : staticFile(s.src)}
            trimBefore={Math.round(s.from * fps)}
            trimAfter={Math.round(s.from * fps) + frames}
            volume={volume}
            objectFit="fill"
            style={{ width: "100%", height: "100%" }}
          />
        </div>
      </AbsoluteFill>
      {style === "rapide" && frame < 3 && index > 0 && <AbsoluteFill style={{ backgroundColor: "#fff", opacity: 0.55 - frame * 0.18 }} />}
    </AbsoluteFill>
  );
};

/* ---------------- texte à l'écran ---------------- */
const Caption: React.FC<{ text: string; style: Style; frames: number; emphasis: boolean }> = ({ text, style, frames, emphasis }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const u = useU();
  if (!text) return null;
  const out = interpolate(frame, [frames - 6, frames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const words = text.split(/\s+/);

  if (style === "rapide") {
    // Mots qui apparaissent un par un, le dernier surligné en violet.
    return (
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: height * 0.2, opacity: out }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 14 * u, maxWidth: "86%" }}>
          {words.map((w, i) => {
            const sp = spring({ frame: frame - i * 4, fps, config: { damping: 12, stiffness: 200 } });
            const last = i === words.length - 1;
            return (
              <span key={i} style={{
                fontFamily: ARCHIVO, fontWeight: 900, fontSize: (emphasis ? 92 : 78) * u, textTransform: "uppercase", letterSpacing: "-0.02em",
                color: last ? "#fff" : "#fff", background: last ? VIOLET : "transparent", padding: last ? `0 ${14 * u}px` : 0, borderRadius: 10 * u,
                transform: `scale(${sp}) translateY(${(1 - sp) * 30}px)`, opacity: sp,
                textShadow: last ? "none" : "0 4px 0 #000, 0 0 24px rgba(0,0,0,.6)",
              }}>{w}</span>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }
  if (style === "informatif") {
    const x = interpolate(frame, [0, 12], [-40, 0], { extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
    const o = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
    return (
      <AbsoluteFill style={{ justifyContent: "flex-end", paddingBottom: height * 0.12, paddingLeft: 60 * u, opacity: o * out }}>
        <div style={{ display: "flex", alignItems: "stretch", transform: `translateX(${x * u}px)`, maxWidth: "84%" }}>
          <div style={{ width: 12 * u, background: VIOLET, borderRadius: 6 * u }} />
          <div style={{ background: "rgba(255,255,255,.94)", padding: `${20 * u}px ${28 * u}px`, borderRadius: `0 ${16 * u}px ${16 * u}px 0`, fontFamily: ARCHIVO, fontWeight: 800, fontSize: 56 * u, color: "#141414", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            {text}
          </div>
        </div>
      </AbsoluteFill>
    );
  }
  if (style === "suspense") {
    // Machine à écrire, centré, serif italique.
    const n = Math.floor(interpolate(frame, [4, 4 + text.length * 1.4], [0, text.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }));
    return (
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 80 * u, opacity: out }}>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 96 * u, color: "#fff", textAlign: "center", lineHeight: 1.05, textShadow: "0 6px 40px rgba(0,0,0,.9)" }}>
          {text.slice(0, n)}<span style={{ opacity: frame % 16 < 8 ? 1 : 0, color: "#EF4444" }}>▌</span>
        </div>
      </AbsoluteFill>
    );
  }
  // Humour : texte manuscrit penché, qui rebondit.
  const sp = spring({ frame, fps, config: { damping: 7, stiffness: 160 } });
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: height * 0.16, opacity: out }}>
      <div style={{ fontFamily: HAND, fontWeight: 700, fontSize: 104 * u, color: LIME, transform: `rotate(-6deg) scale(${sp})`, textAlign: "center", maxWidth: "88%", lineHeight: 1, WebkitTextStroke: `${3 * u}px #141414`, textShadow: `0 ${8 * u}px 0 #141414` }}>
        {text}
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- accroche d'ouverture ---------------- */
const Hook: React.FC<{ text: string; style: Style }> = ({ text, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const u = useU();
  const len = 54;
  const sp = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const out = interpolate(frame, [len - 8, len], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  if (frame > len || !text) return null;
  const dark = style === "suspense";
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: 70 * u, opacity: out, background: `linear-gradient(180deg, rgba(10,6,24,${dark ? 0.75 : 0.45}) 0%, rgba(10,6,24,0) 70%)` }}>
      <div style={{
        fontFamily: style === "suspense" ? SERIF : ARCHIVO, fontStyle: style === "suspense" ? "italic" : "normal",
        fontWeight: 900, fontSize: 118 * u, lineHeight: 0.95, letterSpacing: "-0.04em", textAlign: "center", color: "#fff",
        textTransform: style === "suspense" ? "none" : "uppercase", transform: `scale(${0.8 + 0.2 * sp})`, opacity: sp,
        textShadow: "0 8px 40px rgba(0,0,0,.7)",
      }}>
        {text}
        <div style={{ height: 14 * u, width: `${60 * sp}%`, margin: `${24 * u}px auto 0`, background: VIOLET, borderRadius: 7 * u }} />
      </div>
    </AbsoluteFill>
  );
};

/* ---------------- habillage permanent ---------------- */
const LogoBug: React.FC = () => {
  const u = useU();
  return <Img src={staticFile("brand/saturn-logo-white.png")} style={{ position: "absolute", top: 56 * u, right: 56 * u, height: 40 * u, opacity: 0.9, filter: "drop-shadow(0 2px 8px rgba(0,0,0,.5))" }} />;
};

const Progress: React.FC<{ total: number; color: string }> = ({ total, color }) => {
  const frame = useCurrentFrame();
  const u = useU();
  return <div style={{ position: "absolute", top: 0, left: 0, height: 10 * u, width: `${(frame / total) * 100}%`, background: color, boxShadow: `0 0 16px ${color}` }} />;
};

/** Orbi qui surgit dans un coin sur les moments forts. */
const OrbiPop: React.FC<{ pose: string; side: "left" | "right" }> = ({ pose, side }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const sp = spring({ frame, fps, config: { damping: 9, stiffness: 140 } });
  const out = interpolate(frame, [40, 52], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const h = height * 0.22;
  return (
    <Img src={staticFile(`brand/orbi-${pose}-cut.png`)} style={{
      position: "absolute", bottom: height * 0.05, [side]: -h * 0.12, height: h,
      transform: `translateY(${(1 - sp) * h}px) rotate(${side === "left" ? -8 : 8}deg)`, opacity: out,
      filter: "drop-shadow(0 12px 24px rgba(0,0,0,.45)) drop-shadow(0 0 30px rgba(167,139,250,.5))",
    }} />
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 45%, rgba(0,0,0,.65) 100%)" }} />
);

/* ---------------- écran de fin ---------------- */
const EndCard: React.FC<{ cta: string; orbi: boolean }> = ({ cta, orbi }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const u = useU();
  const sp = spring({ frame, fps, config: { damping: 13, stiffness: 110 } });
  const sp2 = spring({ frame: frame - 8, fps, config: { damping: 12, stiffness: 120 } });
  return (
    <AbsoluteFill style={{ background: "radial-gradient(120% 90% at 50% 70%, #2A1650 0%, #110A22 50%, #06050B 100%)", justifyContent: "center", alignItems: "center", opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }) }}>
      <Img src={staticFile("brand/saturn-logo-white.png")} style={{ position: "absolute", top: height * 0.12, height: 70 * u, transform: `scale(${sp})`, filter: "drop-shadow(0 0 24px rgba(167,139,250,.7))" }} />
      <div style={{ position: "absolute", top: height * 0.24, left: 70 * u, right: 70 * u, textAlign: "center", fontFamily: ARCHIVO, fontWeight: 900, fontSize: 84 * u, color: "#fff", lineHeight: 1, letterSpacing: "-0.03em", opacity: sp2, transform: `translateY(${(1 - sp2) * 40}px)` }}>
        {cta}
      </div>
      {orbi && <Img src={staticFile("brand/orbi-hold-ring-cut.png")} style={{ position: "absolute", bottom: 0, height: height * 0.46, transform: `translateY(${(1 - sp) * height * 0.3}px)`, filter: "drop-shadow(0 0 50px rgba(167,139,250,.5))" }} />}
      <div style={{ position: "absolute", bottom: 48 * u, fontFamily: ARCHIVO, fontWeight: 800, fontSize: 30 * u, color: VIOLET_LIGHT, letterSpacing: "0.14em" }}>@SATURN.AGENCY</div>
    </AbsoluteFill>
  );
};

/* ---------------- composition ---------------- */
export const Montage: React.FC<MontageProps> = (p) => {
  const { fps } = useVideoConfig();
  const spec = STYLE_SPEC[p.style];
  const lens = p.segments.map((s) => segFrames(s, fps));
  const starts: number[] = [];
  lens.reduce((acc, l, i) => { starts[i] = acc; return acc + l - spec.overlap; }, 0);
  const bodyEnd = p.segments.length ? starts[starts.length - 1] + lens[lens.length - 1] : 0;
  const poses = ["wave", "point", "celebrate", "think"];

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {p.segments.map((s, i) => (
        <Sequence key={i} from={starts[i]} durationInFrames={lens[i]} layout="none">
          <Clip s={s} style={p.style} index={i} frames={lens[i]} />
          {p.assets.titles && !(i === 0 && p.assets.intro) && (
            <Sequence from={Math.min(spec.enter, Math.floor(lens[i] / 3))} durationInFrames={Math.max(1, lens[i] - Math.min(spec.enter, Math.floor(lens[i] / 3)))} layout="none">
              <Caption text={s.caption} style={p.style} frames={Math.max(1, lens[i] - Math.min(spec.enter, Math.floor(lens[i] / 3)))} emphasis={s.emphasis} />
            </Sequence>
          )}
          {p.assets.orbi && s.emphasis && (p.style === "humour" || p.style === "rapide") && lens[i] > 30 && (
            <Sequence from={6} durationInFrames={Math.min(52, lens[i] - 6)} layout="none">
              <OrbiPop pose={poses[i % poses.length]} side={i % 2 ? "left" : "right"} />
            </Sequence>
          )}
        </Sequence>
      ))}
      {p.style === "suspense" && <Vignette />}
      {p.assets.intro && <Sequence from={0} durationInFrames={56} layout="none"><Hook text={p.hook} style={p.style} /></Sequence>}
      {p.assets.logo && <Sequence from={0} durationInFrames={Math.max(1, bodyEnd)} layout="none"><LogoBug /></Sequence>}
      {(p.style === "rapide" || p.style === "suspense") && (
        <Sequence from={0} durationInFrames={Math.max(1, bodyEnd)} layout="none"><Progress total={bodyEnd} color={p.style === "suspense" ? "#EF4444" : LIME} /></Sequence>
      )}
      {p.assets.endCard && (
        <Sequence from={bodyEnd} durationInFrames={spec.endCard} layout="none"><EndCard cta={p.cta} orbi={p.assets.orbi} /></Sequence>
      )}
    </AbsoluteFill>
  );
};
