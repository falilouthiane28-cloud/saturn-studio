/** Petites fonctions numériques reproduisant le comportement de Python (portages fidèles). */

export const clamp = (n: number) => Math.max(0.0, Math.min(100.0, n));

/** statistics.mean */
export const moyenne = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** statistics.pstdev (écart type de population) */
export function ecartType(xs: number[]): number {
  const m = moyenne(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
}

/**
 * round(x, 1) de Python : arrondi au plus proche, égalité exacte vers le chiffre pair
 * (« banker's rounding »), alors que Math.round et toFixed arrondissent vers le haut.
 */
export function arrondi1(x: number): number {
  const s = x * 10;
  const f = Math.floor(s);
  const d = s - f;
  let r: number;
  if (Math.abs(d - 0.5) < 1e-9) r = f % 2 === 0 ? f : f + 1;
  else r = Math.round(s);
  return r / 10;
}

/** f"{x:.1f}" de Python. */
export const fmt1 = (x: number) => arrondi1(x).toFixed(1);
