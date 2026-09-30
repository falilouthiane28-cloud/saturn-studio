/**
 * Enveloppe de passage de relais entre agents (JSON).
 *  Nina → Fatou : une formule (formula_id) + la version du propriétaire de l'accroche, avec la preuve.
 *  Fatou → Nina : l'historique de log.md (ce qui a été publié, avec quelle formule).
 */
export type Agent = "fatou" | "nina";

export interface Enveloppe {
  from: Agent;
  to: Agent;
  capability: string; // skill visé chez le destinataire (ex. "ig-reel")
  formula_id: number | null;
  angle: string; // la version du propriétaire (jamais le script d'un autre)
  evidence: string; // d'où ça vient (ligne de swipe.md, extrait de log.md…)
  source_account: string | null; // compte d'origine de la formule (attribution obligatoire)
  created_at: string; // ISO 8601
}

export function creerEnveloppe(e: Omit<Enveloppe, "created_at"> & { created_at?: string }): Enveloppe {
  if (e.from === e.to) throw new Error("Une enveloppe relie deux agents différents.");
  if (e.formula_id !== null && !(Number.isInteger(e.formula_id) && e.formula_id >= 1 && e.formula_id <= 26)) throw new Error("formula_id : entier de 1 à 26, ou null.");
  if (e.from === "nina" && e.to === "fatou") {
    if (e.formula_id === null) throw new Error("Nina → Fatou : une formule est obligatoire.");
    if (!e.source_account) throw new Error("Nina → Fatou : le compte source est obligatoire (on copie des formules, pas des vidéos).");
    if (!e.angle.trim()) throw new Error("Nina → Fatou : l'angle (version du propriétaire) est obligatoire.");
  }
  if (!e.evidence.trim()) throw new Error("La preuve (evidence) est obligatoire.");
  return { ...e, created_at: e.created_at ?? new Date().toISOString() };
}
