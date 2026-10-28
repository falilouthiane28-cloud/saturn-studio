/**
 * Normalisation et validation des numéros de téléphone au format E.164.
 *
 * Fonctions pures (testables sans réseau). Pays par défaut : Sénégal (+221),
 * d'où part la prospection d'AWA. Aucune dépendance externe.
 */

/** Préfixe par défaut quand aucun indicatif international n'est fourni. */
const DEFAULT_COUNTRY = "SN";

/** Indicatif pays → { code, longueur du numéro national attendu }. */
const COUNTRY_DIAL: Record<string, { dial: string; nationalLen: number }> = {
  SN: { dial: "221", nationalLen: 9 }, // Sénégal : 9 chiffres (ex. 77 123 45 67)
  FR: { dial: "33", nationalLen: 9 }, // France : 9 chiffres après le 0
  CI: { dial: "225", nationalLen: 10 }, // Côte d'Ivoire : 10 chiffres
};

export interface NormalizedPhone {
  /** Numéro E.164, ex. "+221771234567". */
  e164: string;
  /** Indicatif pays sans "+", ex. "221". */
  dial: string;
}

export class PhoneError extends Error {}

/**
 * Normalise un numéro brut en E.164.
 *
 * - Accepte "+221 77 123 45 67", "00221771234567", "0771234567", "771234567".
 * - Sans indicatif, applique le pays par défaut (SN) ou `country`.
 * - Rejette (PhoneError) : vide, non numérique, trop court/long.
 *
 * Ne devine jamais un indicatif ambigu : un numéro national est rattaché au
 * seul pays par défaut, jamais à un pays « probable ».
 */
export function normalizePhone(raw: string, country = DEFAULT_COUNTRY): NormalizedPhone {
  if (!raw || typeof raw !== "string") {
    throw new PhoneError("Numéro de téléphone vide.");
  }

  // Ne garde que les chiffres et un éventuel "+" en tête.
  const hasPlus = raw.trim().startsWith("+");
  let digits = raw.replace(/[^\d]/g, "");

  // "00" en préfixe international (ex. 0033…) → équivalent à "+".
  let international = hasPlus;
  if (!international && digits.startsWith("00")) {
    digits = digits.slice(2);
    international = true;
  }

  if (!digits) {
    throw new PhoneError("Numéro de téléphone invalide (aucun chiffre).");
  }

  const def = COUNTRY_DIAL[country] ?? COUNTRY_DIAL[DEFAULT_COUNTRY];

  if (international) {
    // Le numéro porte déjà son indicatif pays.
    const matched = matchDial(digits);
    if (!matched) {
      throw new PhoneError(`Indicatif pays non reconnu : +${digits.slice(0, 4)}…`);
    }
    const national = digits.slice(matched.dial.length);
    assertNationalLength(national, matched.nationalLen);
    return { e164: `+${digits}`, dial: matched.dial };
  }

  // Numéro national : on retire un éventuel 0 de tête (plan national) et on
  // préfixe l'indicatif du pays par défaut.
  const national = digits.replace(/^0+/, "");
  assertNationalLength(national, def.nationalLen);
  return { e164: `+${def.dial}${national}`, dial: def.dial };
}

/** Retrouve l'indicatif pays connu en tête d'une suite de chiffres. */
function matchDial(digits: string): { dial: string; nationalLen: number } | null {
  // Teste les indicatifs les plus longs d'abord (évite 22 vs 221).
  const entries = Object.values(COUNTRY_DIAL).sort((a, b) => b.dial.length - a.dial.length);
  for (const e of entries) {
    if (digits.startsWith(e.dial)) return e;
  }
  return null;
}

function assertNationalLength(national: string, expected: number): void {
  if (national.length < expected - 1 || national.length > expected + 1) {
    throw new PhoneError(
      `Numéro invalide : ${national.length} chiffres, ${expected} attendus (hors indicatif).`
    );
  }
}

/** Validité simple (true/false) sans lever d'exception. */
export function isValidPhone(raw: string, country = DEFAULT_COUNTRY): boolean {
  try {
    normalizePhone(raw, country);
    return true;
  } catch {
    return false;
  }
}

/**
 * Masque un numéro pour les journaux : garde l'indicatif + 2 chiffres de tête
 * et les 2 derniers. Ex. "+221771234567" → "+22177****67".
 * Ne jamais journaliser le numéro complet.
 */
export function maskPhone(e164: string): string {
  const s = String(e164);
  if (s.length <= 8) return "****";
  const head = s.slice(0, 6); // "+" + indicatif + 2 chiffres, ex. "+22177"
  const tail = s.slice(-2);
  return `${head}****${tail}`;
}
