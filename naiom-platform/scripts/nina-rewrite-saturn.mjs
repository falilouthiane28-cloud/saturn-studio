/**
 * Nina — pass ig_human sur les réécritures @saturn_sn.
 * Une seule exécution : imprime chaque candidat + son score humain FR (indicatif) et hookscore.
 */
import { passerIgHuman, hookscore, scoreProfil } from "../src/lib/instagram/tools.ts";

const nameFieldOpts = [
  "SATURN · Studio design Dakar",
  "SATURN · Motion design & tech",
  "SATURN | Sites & apps design",
];

const bioLine1Opts = [
  "Sites et interfaces qui vendent — pour les marques qui veulent sortir du template.",
  "Studio design + tech à Dakar. On fait les marques que les gens remarquent.",
  "On dessine les marques et les produits que tes concurrents auraient voulu avoir.",
];

const bioBodyOpts = [
  "De la marque à l'app, on livre en 6 semaines. → DM « brief » pour un devis.",
  "Site, identité, app : plusieurs marques livrées cette année. DM « brief » et on parle.",
];

const compter = (s) => [...s].length;

async function scoreLine(t) {
  const h = await passerIgHuman(t, "fr");
  const hs = await hookscore([t], "fr");
  return { human_score: h.human_score, verdict: h.verdict, top_hookscore: hs.classement[0].score };
}

const rapport = { name_field: [], bio_first_line: [], bio_body: [] };
for (const t of nameFieldOpts) rapport.name_field.push({ texte: t, chars: compter(t), ...(await scoreLine(t)) });
for (const t of bioLine1Opts)  rapport.bio_first_line.push({ texte: t, chars: compter(t), ...(await scoreLine(t)) });
for (const t of bioBodyOpts)   rapport.bio_body.push({ texte: t, chars: compter(t), ...(await scoreLine(t)) });

console.log(JSON.stringify(rapport, null, 2));

const reScore = scoreProfil({
  name_field: 10, bio_first_line: 10, bio_body: 6, pinned_three: 8, link: 6, highlights: 6,
  grid_legibility: 4, photo: 4, handle: 2, category_contact: 2, recent_activity: 6, story_presence: 5,
});
console.log("\n=== RE-SCORE APRÈS RÉÉCRITURES ===");
console.log(`Total : ${reScore.total}/${reScore.sur}  (avant : 31/100  delta : +${reScore.total - 31})`);
console.log("Points à travailler ensuite :");
for (const it of reScore.aTravailler) console.log(`  ${it.id} : ${it.note}/${it.sur} (perd ${it.manque})`);
