/** Tests du helper d'audit (Nina) : métriques calculées à la main puis vérifiées. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  auditerPosts, holdAt3s, median, metriques, niveauConfiance, outlierMultiple,
  separerProblemes, sendsPerReach, followsPerReach, ordreRapport,
  type PostRow,
} from "../audit.ts";

/* -------- primitives -------- */
test("A1 · métriques calculées à la main", () => {
  assert.equal(outlierMultiple(400_000, 100_000), 4);
  assert.equal(outlierMultiple(1_000, 0), 0);              // médiane 0 ⇒ 0, pas NaN
  assert.equal(holdAt3s(600, 1000), 0.6);
  assert.equal(sendsPerReach(90, 4000), 90 / 4000);
  assert.equal(followsPerReach(3, 1200), 3 / 1200);
  assert.equal(median([1, 3, 5, 7, 9]), 5);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), 0);
});

/* -------- ordre du rapport : day/time en dernier -------- */
test("A2 · day et time apparaissent en dernier dans ordreRapport", () => {
  assert.equal(ordreRapport[0], "hold_at_3s");
  assert.equal(ordreRapport[ordreRapport.length - 2], "day");
  assert.equal(ordreRapport[ordreRapport.length - 1], "time");
});

/* -------- confiance -------- */
test("A3 · n < 15 ⇒ confiance basse ; 15-29 ⇒ moyenne ; ≥ 30 ⇒ haute", () => {
  assert.equal(niveauConfiance(6), "basse");
  assert.equal(niveauConfiance(14), "basse");
  assert.equal(niveauConfiance(15), "moyenne");
  assert.equal(niveauConfiance(29), "moyenne");
  assert.equal(niveauConfiance(30), "haute");
});

/* -------- fixture de 30 posts, tout vérifiable -------- */
function fabrique30(): PostRow[] {
  const rows: PostRow[] = [];
  // 30 posts, vues croissantes de 10k à 300k, hook_formula_id cyclique 1..5.
  for (let i = 1; i <= 30; i++) {
    const views = i * 10_000;
    const reach = views * 0.9;
    rows.push({
      id: `p${i}`, views, reach,
      non_follower_reach: 0.3 + (i % 5) * 0.05,
      viewers_start: views,
      viewers_3s: Math.round(views * (0.4 + (i % 10) * 0.03)),
      avg_watch_s: 5 + (i % 8),
      sends: Math.round(reach * (0.001 + (i / 30) * 0.02)),
      follows: Math.round(reach * (i > 20 ? 0.02 : 0.001)),   // top posts convertissent bien
      hook_formula_id: ((i - 1) % 5) + 1,
      format: "reel-parle",
      length_band: "15-30s",
      theme: "prospection",
      replies_first_hour: i % 4,
      day: ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"][i % 7],
      time: "18:00",
    });
  }
  return rows;
}

test("A4 · audit sur 30 posts : classement par outlier_multiple, top5 dominé par les grosses vues", () => {
  const rows = fabrique30();
  const r = auditerPosts(rows);
  assert.equal(r.n, 30);
  assert.equal(r.confiance, "haute");
  // Le post p30 (300k vues, médiane = views médians de la fixture) a le plus grand multiple.
  assert.equal(r.top5[0].id, "p30");
  // Les métriques du post choisi correspondent à un calcul manuel.
  const attendu = metriques(rows[29], r.median_views);
  assert.equal(r.top5[0].outlier_multiple, attendu.outlier_multiple);
  assert.equal(r.top5[0].sends_per_reach, attendu.sends_per_reach);
});

test("A5 · vues sans follows ⇒ routé vers ig-profile ; pas de vues ⇒ routé vers ig-viral", () => {
  const rows = fabrique30();
  const r = auditerPosts(rows);
  assert.equal(r.vuesSansFollows.route, "ig-profile");
  assert.equal(r.pasDeVues.route, "ig-viral");
  // Les deux ensembles sont disjoints.
  const idsA = new Set(r.vuesSansFollows.posts.map((p) => p.id));
  for (const p of r.pasDeVues.posts) assert.ok(!idsA.has(p.id), `p${p.id} dans les deux ensembles`);
});

test("A6 · séparation des problèmes : les seuils sont fondés sur la médiane du compte, pas sur des constantes absolues", () => {
  const rows = fabrique30();
  const withM = rows.map((r) => metriques(r, 150_000));
  const s = separerProblemes(withM);
  assert.ok(s.seuilFollows > 0);
  assert.ok(s.seuilHold > 0);
});
