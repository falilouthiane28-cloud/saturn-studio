import { Composition } from "remotion";
import { Montage } from "./Montage";
import { totalFrames, type MontageProps } from "./types";

const DEMO: MontageProps = {
  width: 1080, height: 1920, fps: 30, style: "rapide", variantLabel: "Démo",
  hook: "Ton accroche ici", cta: "Suis Saturn Studio",
  segments: [],
  assets: { intro: true, logo: true, titles: true, endCard: true, orbi: true },
};

export const Root: React.FC = () => (
  <Composition
    id="Montage"
    component={Montage}
    defaultProps={DEMO}
    width={DEMO.width}
    height={DEMO.height}
    fps={DEMO.fps}
    durationInFrames={120}
    // Dimensions et durée dépendent du format et des segments choisis par Fatou.
    calculateMetadata={({ props }) => ({ width: props.width, height: props.height, fps: props.fps, durationInFrames: totalFrames(props) })}
  />
);
