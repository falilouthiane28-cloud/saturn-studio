import { planGoal } from "@/lib/orchestration/plan";

export const runtime = "nodejs";

/**
 * POST /api/orchestration/plan
 * body : { goal: string }
 *
 * Le chef d'équipe découpe l'objectif et répartit les tâches entre les agents.
 */
export async function POST(req: Request) {
  let goal = "";
  try {
    const body = (await req.json()) as { goal?: unknown };
    goal = typeof body.goal === "string" ? body.goal.trim() : "";
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (goal.length < 8) {
    return Response.json(
      { error: "Décrivez l'objectif en une phrase au moins." },
      { status: 400 }
    );
  }
  // Borne haute : au-delà, c'est un brief complet, pas un objectif à découper.
  if (goal.length > 2000) {
    return Response.json({ error: "Objectif trop long (2000 caractères max)." }, { status: 400 });
  }

  try {
    const plan = await planGoal(goal);
    return Response.json(plan);
  } catch (err) {
    console.error("[orchestration] échec de planification", err);
    return Response.json(
      { error: "Le chef d'équipe n'a pas pu établir le plan. Réessayez." },
      { status: 500 }
    );
  }
}
