/**
 * Helper d'audit pour Nina (ig-audit). Le pack ne livre pas de script pour ce skill,
 * donc les métriques sont calculées ici — testables, reproductibles, sans invention.
 *
 * Principes appliqués :
 *  - on classe par outlier_multiple (vues / médiane du compte) et sends_per_reach, pas par vues.
 *  - hold_at_3s = viewers_3s / viewers_start, la note du hook.
 *  - non_follower_reach est repris tel quel (déjà en fraction dans les insights collés).
 *  - « vues sans follows » (outlier_multiple ≥ 1 ET follows_per_reach anormalement bas)
 *    est un problème de profil (routé vers ig-profile), pas de hook.
 *  - « pas de vues » (outlier_multiple < 1) est un problème de hook.
 *  - n < 15 → confiance basse, aucun motif ne devient une conclusion.
 *  - day / time ne sont jamais présentés en premier : voir `ordreRapport`.
 */

export interface PostRow {
  id: string;
  views: number;
  reach: number;
  non_follower_reach: number; // fraction 0..1 (part de la portée hors abonnés)
  viewers_start: number; // spectateurs qui ont démarré le reel
  viewers_3s: number;    // spectateurs encore là à 3 s
  avg_watch_s: number;   // seconde
  sends: number;
  follows: number;
  hook_formula_id: number | null; // 1..26 selon hooks.json, ou null si inclassable
  format: string;        // "reel-parle" | "b-roll" | "carrousel" | "story" | …
  length_band: string;   // "0-15s" | "15-30s" | "30-60s" | "60s+"
  theme: string;
  replies_first_hour: number;
  day: string;           // "lun".."dim" ou "mon".."sun"
  time: string;          // "18:00", "matin", etc.
}

export interface RowMetrics {
  outlier_multiple: number;
  hold_at_3s: number;
  avg_watch_s: number;
  sends_per_reach: number;
  follows_per_reach: number;
  non_follower_reach: number;
}

export interface PostWithMetrics extends PostRow, RowMetrics {}

/** Médiane robuste, ignore les valeurs non finies. */
export function median(xs: number[]): number {
  const v = xs.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

const safe = (a: number, b: number) => (b > 0 ? a / b : 0);

/** Multiple d'outlier = vues / médiane des vues du compte. */
export function outlierMultiple(views: number, accountMedianViews: number): number {
  return safe(views, accountMedianViews);
}
export const holdAt3s = (v3: number, vStart: number) => safe(v3, vStart);
export const sendsPerReach = (sends: number, reach: number) => safe(sends, reach);
export const followsPerReach = (follows: number, reach: number) => safe(follows, reach);

/** Calcule toutes les métriques d'un post à partir de la médiane du compte. */
export function metriques(row: PostRow, accountMedianViews: number): PostWithMetrics {
  return {
    ...row,
    outlier_multiple: outlierMultiple(row.views, accountMedianViews),
    hold_at_3s: holdAt3s(row.viewers_3s, row.viewers_start),
    avg_watch_s: row.avg_watch_s,
    sends_per_reach: sendsPerReach(row.sends, row.reach),
    follows_per_reach: followsPerReach(row.follows, row.reach),
    non_follower_reach: row.non_follower_reach,
  };
}

/** Confiance dérivée du nombre de posts (règle Nina : 30 peut montrer un motif, 6 ne peut pas). */
export type Confiance = "basse" | "moyenne" | "haute";
export function niveauConfiance(n: number): Confiance {
  if (n < 15) return "basse";
  if (n < 30) return "moyenne";
  return "haute";
}

/** Routage d'une conclusion vers le bon skill de rechange. */
export type Route = "ig-profile" | "ig-viral" | "aucun";

/**
 * Sépare les posts problématiques :
 *  - « vues mais pas de follows » : reels qui ont trouvé une audience (outlier ≥ 1) mais dont
 *    le profil ne convertit pas (follows_per_reach dans le quart inférieur). → ig-profile.
 *  - « pas de vues » : hook qui n'accroche pas (outlier < 1 ET hold_at_3s bas). → ig-viral.
 */
export function separerProblemes(posts: PostWithMetrics[]): {
  vuesSansFollows: PostWithMetrics[];
  pasDeVues: PostWithMetrics[];
  seuilFollows: number;
  seuilHold: number;
} {
  const fpr = posts.map((p) => p.follows_per_reach).filter((x) => x > 0);
  const holds = posts.map((p) => p.hold_at_3s).filter((x) => x > 0);
  const seuilFollows = median(fpr) * 0.5; // moitié de la médiane du compte
  const seuilHold = median(holds) * 0.75;
  const vuesSansFollows = posts.filter((p) => p.outlier_multiple >= 1 && p.follows_per_reach < seuilFollows);
  const pasDeVues = posts.filter((p) => p.outlier_multiple < 1 && p.hold_at_3s < seuilHold);
  return { vuesSansFollows, pasDeVues, seuilFollows, seuilHold };
}

/** Ordre imposé du rapport : jamais day/time en premier. */
export const ordreRapport = [
  "hold_at_3s",
  "hook_formula_id",
  "format",
  "length_band",
  "theme",
  "replies_first_hour",
  "day",
  "time",
] as const;

export interface AuditResultat {
  n: number;
  confiance: Confiance;
  median_views: number;
  top5: PostWithMetrics[];
  bottom5: PostWithMetrics[];
  vuesSansFollows: { posts: PostWithMetrics[]; route: "ig-profile" };
  pasDeVues: { posts: PostWithMetrics[]; route: "ig-viral" };
  claims: Claim[];
  ordre_rapport: readonly string[];
}

export interface Claim {
  claim: string;
  evidence: string;
  confidence: Confiance;
}

/**
 * Audit complet. `rows` est ce que le propriétaire a collé ; on calcule tout,
 * on classe par outlier_multiple puis par sends_per_reach, on ne présente rien
 * comme « finding » si n < 15.
 */
export function auditerPosts(rows: PostRow[]): AuditResultat {
  const n = rows.length;
  const confiance = niveauConfiance(n);
  const medv = median(rows.map((r) => r.views));
  const withMetrics = rows.map((r) => metriques(r, medv));
  // Tri : outlier_multiple d'abord, sends_per_reach en second (départage).
  const classe = [...withMetrics].sort((a, b) => (b.outlier_multiple - a.outlier_multiple) || (b.sends_per_reach - a.sends_per_reach));
  const top5 = classe.slice(0, 5);
  const bottom5 = classe.slice(-5).reverse();
  const { vuesSansFollows, pasDeVues } = separerProblemes(withMetrics);

  // Claims : jamais transformer un motif en règle si la confiance ne le permet pas.
  const claims: Claim[] = [];
  if (confiance !== "basse") {
    const holdTop = median(top5.map((p) => p.hold_at_3s));
    const holdBot = median(bottom5.map((p) => p.hold_at_3s));
    if (holdTop > holdBot * 1.2) {
      claims.push({
        claim: "Le top 5 tient au moins 20 % de plus à 3 s que le bottom 5 : le hook est le levier principal.",
        evidence: `hold_at_3s (médiane) top5 = ${holdTop.toFixed(2)} vs bottom5 = ${holdBot.toFixed(2)}`,
        confidence: confiance,
      });
    }
    // Formules gagnantes : au moins 3 apparitions dans le top 5.
    const compteFormules = new Map<number, number>();
    for (const p of top5) if (p.hook_formula_id != null) compteFormules.set(p.hook_formula_id, (compteFormules.get(p.hook_formula_id) ?? 0) + 1);
    for (const [fid, c] of compteFormules) if (c >= 3) claims.push({
      claim: `La formule ${fid} apparaît ${c} fois dans le top 5 : à refaire.`,
      evidence: `${c}/5 posts du top 5 sont de la formule ${fid}`,
      confidence: confiance,
    });
  } else {
    claims.push({
      claim: `Échantillon trop court (${n} posts) : rien n'est encore une conclusion, seulement des indices.`,
      evidence: `n=${n} < 15`,
      confidence: "basse",
    });
  }

  return {
    n,
    confiance,
    median_views: medv,
    top5,
    bottom5,
    vuesSansFollows: { posts: vuesSansFollows, route: "ig-profile" },
    pasDeVues: { posts: pasDeVues, route: "ig-viral" },
    claims,
    ordre_rapport: ordreRapport,
  };
}
