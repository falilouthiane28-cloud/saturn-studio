export type Style = "rapide" | "informatif" | "suspense" | "humour";

export interface Segment {
  src: string; // URL http du rush (servi par le poste de montage)
  from: number; // secondes dans le rush
  to: number;
  caption: string; // texte à l'écran (peut être vide)
  focusX: number; // 0 → 1 : position horizontale du sujet, pour recadrer sans le couper
  aspect: number; // largeur / hauteur du rush
  emphasis: boolean; // moment fort (effet renforcé)
}

export interface MontageProps extends Record<string, unknown> {
  width: number;
  height: number;
  fps: number;
  style: Style;
  segments: Segment[];
  hook: string;
  cta: string;
  variantLabel: string;
  assets: { intro: boolean; logo: boolean; titles: boolean; endCard: boolean; orbi: boolean };
}

/** Réglages de rythme et de transition par style. */
export const STYLE_SPEC: Record<Style, { overlap: number; enter: number; endCard: number }> = {
  rapide: { overlap: 0, enter: 6, endCard: 60 },
  informatif: { overlap: 10, enter: 10, endCard: 75 },
  suspense: { overlap: 0, enter: 12, endCard: 75 },
  humour: { overlap: 8, enter: 8, endCard: 66 },
};

export function segFrames(s: Segment, fps: number): number {
  return Math.max(1, Math.round((s.to - s.from) * fps));
}

/** Durée totale en images (segments qui se chevauchent pendant les transitions + écran de fin). */
export function totalFrames(p: MontageProps): number {
  const spec = STYLE_SPEC[p.style];
  const body = p.segments.reduce((a, s) => a + segFrames(s, p.fps), 0) - spec.overlap * Math.max(0, p.segments.length - 1);
  return Math.max(1, body + (p.assets.endCard ? spec.endCard : 0));
}
