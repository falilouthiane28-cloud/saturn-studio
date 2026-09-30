/** Réglages de la couche Instagram. LANG : langue des textes produits par les agents. */
export type Langue = "fr" | "en";
export const LANG: Langue = process.env.IG_LANG === "en" ? "en" : "fr";
