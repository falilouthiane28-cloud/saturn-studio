/**
 * Nina — ig-plan semaine du 1er au 6 octobre 2026 pour @saturn_sn.
 * Valide le plan (verifierPlan), passe chaque accroche par ig_human, écrit plan.md
 * dans le dossier d'état Instagram (celui que Fatou lit à chaque tour).
 */
import { verifierPlan } from "../src/lib/instagram/nina.ts";
import { passerIgHuman } from "../src/lib/instagram/tools.ts";
import { EtatFichiers, DOSSIER_ETAT_DEFAUT } from "../src/lib/instagram/stateStore.ts";

const plan = {
  creneaux: [
    { jour: "jeu 01/10", type: "reel", theme: "IA", angle: "teach", hook_formula_id: 3, hook_line: "Personne ne te dit pourquoi ton IA invente des réponses. Voilà la vraie raison." },
    { jour: "ven 02/10", type: "carrousel", theme: "design", angle: "proof", hook_formula_id: 13, hook_line: "Avant, après : la même marque, refaite par Saturn." },
    { jour: "sam 03/10", type: "reel", theme: "motion design", angle: "story", hook_formula_id: 24, hook_line: "Voilà comment notre robot est né, image par image." },
    { jour: "lun 05/10", type: "story", theme: "branding", angle: "opinion", hook_formula_id: 22, hook_line: "Un beau logo ne fait pas une marque. Voilà ce qui la fait." },
    { jour: "mar 06/10", type: "reel", theme: "offre", angle: "offer", hook_formula_id: 20, hook_line: "Tu as le droit de ne pas avoir un site parfait. Pas de ne pas en avoir du tout." },
  ],
  engagement: [
    ...[1, 2, 3, 4, 5].map((i) => ({ compte: `{{compte reach ${i}}}`, role: "reach" })),
    ...[1, 2, 3].map((i) => ({ compte: `{{studio pair ${i}}}`, role: "peer" })),
    ...[1, 2].map((i) => ({ compte: `{{client potentiel ${i}}}`, role: "buyer" })),
  ],
};

const v = verifierPlan(plan);
console.log("verifierPlan :", v.valide ? "VALIDE" : v.erreurs.join(" | "));
if (!v.valide) process.exit(1);

const lignes = [];
for (const c of plan.creneaux) {
  const h = await passerIgHuman(c.hook_line, "fr");
  h.text = h.text.trim();
  console.log(`${c.jour} · ${c.type} · #${c.hook_formula_id} · human ${h.human_score} (${h.verdict}) · « ${h.text} »`);
  lignes.push(`| ${c.jour} | ${c.type} | ${c.theme} | ${c.angle} | #${c.hook_formula_id} | ${h.text} |`);
}

const md = `# plan.md — @saturn_sn — semaine du 1er au 6 octobre 2026

Écrit par Nina (ig-plan). Rien n'est programmé : Fatou rédige, le propriétaire publie.
Les deux premières secondes comptent bien plus que l'heure de publication.

| jour | format | thème | angle | formule | accroche (version du propriétaire, passée par ig_human) |
|---|---|---|---|---|---|
${lignes.join("\n")}

## Liste d'engagement quotidienne (pour ig-comment de Fatou)
Nina ne propose aucun compte inventé : le propriétaire remplit les 10 noms.
- 5 reach (gros comptes où ton audience traîne) : ${plan.engagement.filter((e) => e.role === "reach").map((e) => e.compte).join(", ")}
- 3 pairs (studios ou créateurs de ta taille) : ${plan.engagement.filter((e) => e.role === "peer").map((e) => e.compte).join(", ")}
- 2 acheteurs (marques qui pourraient te payer) : ${plan.engagement.filter((e) => e.role === "buyer").map((e) => e.compte).join(", ")}

## Relais
- sam 03/10 : le Reel utilise la vidéo motion design de lancement (brief : content/saturn-motion/brief.md).
`;

const etat = new EtatFichiers();
await etat.ecrire("plan.md", md);
console.log(`\nplan.md écrit dans ${DOSSIER_ETAT_DEFAUT}`);
