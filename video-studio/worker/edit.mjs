/**
 * Transforme le plan de Fatou (unités gardées, priorités, textes, cadrage) en variantes
 * de montage prêtes pour Remotion. Déterministe : les coupes restent sur les unités détectées.
 */

export const SIZES = {
  "9:16": [1080, 1920],
  "4:5": [1080, 1350],
  "1:1": [1080, 1080],
  "16:9": [1920, 1080],
};

const len = (s) => s.to - s.from;
const total = (list) => list.reduce((a, s) => a + len(s), 0);

/** Retire les unités les moins prioritaires (la plus longue d'abord) jusqu'à tenir la durée visée. */
function fit(list, target, keepId) {
  if (!target) return list;
  let out = [...list];
  for (const prio of [3, 2]) {
    while (total(out) > target * 1.08) {
      const cand = out.filter((s) => s.priority === prio && s.unit !== keepId).sort((a, b) => len(b) - len(a))[0];
      if (!cand) break;
      out = out.filter((s) => s !== cand);
    }
  }
  // Toujours trop long : on raccourcit la dernière unité (fin de phrase conservée au mieux).
  if (total(out) > target * 1.15 && out.length) {
    const last = out[out.length - 1];
    const excess = total(out) - target;
    if (len(last) - excess > 1.5) out[out.length - 1] = { ...last, to: +(last.to - excess).toFixed(2) };
  }
  return out;
}

/**
 * @param units   unités détectées [{id, clip, from, to, kind}]
 * @param plan    réponse de Fatou {hook, cta, keep:[{unit, priority, caption, focusX}], hookUnit}
 * @param srcOf   (clipIndex) => URL http du rush
 * @param job     {duration, variants}
 */
export function buildVariants(units, plan, srcOf, job, aspectOf = () => 16 / 9) {
  const byId = new Map(units.map((u) => [u.id, u]));
  const kept = plan.keep
    .map((k) => ({ ...byId.get(k.unit), ...k }))
    .filter((s) => s.clip !== undefined)
    .sort((a, b) => a.clip - b.clip || a.from - b.from);
  if (!kept.length) throw new Error("Le plan ne garde aucune unité.");
  const hook = kept.find((s) => s.unit === plan.hookUnit) ?? kept[0];
  const target = Number(job.duration) || 0;
  const toSeg = (s, extra = {}) => ({
    aspect: aspectOf(s.clip),
    src: srcOf(s.clip), from: s.from, to: s.to, caption: s.caption ?? "", focusX: s.focusX ?? 0.5,
    emphasis: s.unit === hook.unit || s.priority === 1, ...extra,
  });

  const variants = [];
  // A — fidèle : ordre chronologique.
  variants.push({ key: "a", label: "Fidèle", segments: fit(kept, target, hook.unit).map((s) => toSeg(s)) });
  // B — accroche d'abord : un teaser du moment fort ouvre la vidéo.
  const teaserLen = Math.min(3, len(hook));
  const teaser = toSeg({ ...hook, to: +(hook.from + teaserLen).toFixed(2) }, { caption: "", emphasis: true });
  const restB = fit(kept, target ? Math.max(3, target - teaserLen) : 0, hook.unit);
  variants.push({ key: "b", label: "Accroche d'abord", segments: [teaser, ...restB.map((s) => toSeg(s))] });
  // C — serré : l'essentiel seulement, marges resserrées.
  const core = kept.filter((s) => s.priority <= 2 || s.unit === hook.unit);
  const tight = fit(core.length >= 2 ? core : kept, target ? target * 0.8 : 0, hook.unit).map((s) =>
    s.kind === "speech" && len(s) > 1.2 ? { ...s, from: +(s.from + 0.06).toFixed(2), to: +(s.to - 0.06).toFixed(2) } : s);
  variants.push({ key: "c", label: "Serré", segments: tight.map((s) => toSeg(s)) });

  return variants.slice(0, Math.max(1, Math.min(3, Number(job.variants) || 3)));
}
