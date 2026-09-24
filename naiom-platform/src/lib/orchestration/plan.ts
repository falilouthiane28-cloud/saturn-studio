import { createAnthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { listAgents, TEAM_LEADER_SLUG } from "@/lib/agents";
import type { AgentSlug } from "@/lib/types";
import type { OrchestrationPlan, OrchestrationTask } from "./types";

/**
 * Couche d'orchestration — POSÉE AU-DESSUS des agents, jamais dedans.
 *
 * Aucun `.md` d'agent n'est modifié : le chef d'équipe reçoit simplement la
 * liste des coéquipiers et de leurs spécialités, et rend une découpe en
 * tâches. Chaque tâche reste exécutée par son agent, avec son propre prompt
 * métier inchangé.
 */

/** Construit la consigne de planification donnée au chef d'équipe. */
function buildPlannerPrompt(
  goal: string,
  team: { slug: string; name: string; role: string; tagline: string }[],
  leaderName: string
): string {
  const roster = team
    .map((a) => `- \`${a.slug}\` — **${a.name}**, ${a.role}. ${a.tagline}`)
    .join("\n");

  return `Tu es **${leaderName}**, chef d'équipe de Saturn Studio.

On te confie un objectif de haut niveau. Ton travail n'est PAS de le réaliser
toi-même : c'est de le découper en tâches et de les confier aux bons agents.

## Ton équipe

${roster}

## Objectif

${goal}

## Ce que tu rends

Un objet JSON, et rien d'autre — pas de texte autour, pas de bloc de code :

{
  "rationale": "une phrase expliquant la découpe retenue",
  "tasks": [
    {
      "id": "t1",
      "agentSlug": "<un slug de la liste ci-dessus>",
      "title": "intitulé court",
      "brief": "la consigne précise transmise à cet agent",
      "dependsOn": []
    }
  ]
}

## Règles

- Entre 2 et 5 tâches. Pas de tâche pour le plaisir d'occuper tout le monde.
- \`agentSlug\` doit appartenir strictement à la liste ci-dessus.
- \`dependsOn\` contient les ids des tâches dont le livrable alimente celle-ci.
  Sers-t'en dès qu'un agent a besoin du travail d'un autre pour commencer.
- L'ordre du tableau doit respecter les dépendances.
- Français.`;
}

/** Valide et normalise la sortie du modèle. Un plan invalide est rejeté. */
function parsePlan(
  raw: string,
  validSlugs: Set<string>
): { rationale: string; tasks: OrchestrationTask[] } | null {
  // Le modèle enrobe parfois le JSON malgré la consigne : on isole l'objet.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }

  const obj = parsed as { rationale?: unknown; tasks?: unknown };
  if (!Array.isArray(obj.tasks) || obj.tasks.length === 0) return null;

  const tasks: OrchestrationTask[] = [];
  for (const t of obj.tasks) {
    const raw = t as Record<string, unknown>;
    const slug = String(raw.agentSlug ?? "");
    // Un slug hors équipe signifierait une tâche envoyée à un agent
    // inexistant : on écarte la tâche plutôt que de créer un fantôme.
    if (!validSlugs.has(slug)) continue;
    tasks.push({
      id: String(raw.id ?? `t${tasks.length + 1}`),
      agentSlug: slug as AgentSlug,
      title: String(raw.title ?? "Tâche"),
      brief: String(raw.brief ?? ""),
      dependsOn: Array.isArray(raw.dependsOn) ? raw.dependsOn.map(String) : [],
      status: "en-attente",
    });
  }
  if (tasks.length === 0) return null;

  // Une dépendance vers une tâche écartée casserait la chaîne : on la retire.
  const ids = new Set(tasks.map((t) => t.id));
  for (const t of tasks) t.dependsOn = t.dependsOn.filter((d) => ids.has(d));

  return {
    rationale: String(obj.rationale ?? "Découpe proposée par le chef d'équipe."),
    tasks,
  };
}

/**
 * Plan de repli, sans appel modèle.
 *
 * Il suit la chaîne que les prompts métier décrivent déjà
 * (prospection → analyse de call → proposition), pour que la vue reste
 * démontrable quand `ANTHROPIC_API_KEY` est absente.
 */
function fallbackPlan(goal: string, team: { slug: string; name: string }[]): {
  rationale: string;
  tasks: OrchestrationTask[];
} {
  const has = (s: string) => team.some((a) => a.slug === s);
  const chain: { slug: AgentSlug; title: string; brief: string }[] = [];

  if (has("prospection"))
    chain.push({
      slug: "prospection",
      title: "Cibler et contacter",
      brief: `Identifier les prospects pertinents pour : ${goal}`,
    });
  if (has("fireflies"))
    chain.push({
      slug: "fireflies",
      title: "Analyser les échanges",
      brief: "Transformer les calls obtenus en plan d'action équipe.",
    });
  if (has("proposition"))
    chain.push({
      slug: "proposition",
      title: "Rédiger la proposition",
      brief: "Reprendre l'analyse du call et produire la proposition PDF.",
    });

  const tasks: OrchestrationTask[] = chain.map((c, i) => ({
    id: `t${i + 1}`,
    agentSlug: c.slug,
    title: c.title,
    brief: c.brief,
    dependsOn: i === 0 ? [] : [`t${i}`],
    status: "en-attente",
  }));

  return {
    // Motif exact porté par `offlineReason` : ici on décrit seulement la
    // découpe, sinon les deux messages se contredisent à l'écran.
    rationale:
      "Chaîne par défaut : prospection, puis analyse du call, puis proposition.",
    tasks,
  };
}

/** Produit un plan d'orchestration pour un objectif donné. */
export async function planGoal(goal: string): Promise<OrchestrationPlan> {
  const agents = await listAgents();
  const leader = agents.find((a) => a.slug === TEAM_LEADER_SLUG) ?? agents[0];
  // Le chef ne se confie pas de tâche à lui-même dans la découpe initiale :
  // il coordonne. Il reste dans la liste car il peut analyser un call.
  const team = agents.map((a) => ({
    slug: a.slug,
    name: a.name,
    role: a.role,
    tagline: a.tagline,
  }));

  const base = {
    goal,
    leader: leader.slug,
    createdAt: new Date().toISOString(),
  };

  /** Repli commun : on rend toujours une chaîne exploitable, jamais une vue vide. */
  const degrade = (reason: string): OrchestrationPlan => ({
    ...base,
    ...fallbackPlan(goal, team),
    offline: true,
    offlineReason: reason,
  });

  if (!process.env.ANTHROPIC_API_KEY) {
    return degrade("ANTHROPIC_API_KEY absente de .env.local");
  }

  let text: string;
  try {
    const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await generateText({
      // Découper un objectif est une tâche de raisonnement : le chef d'équipe
      // utilise Sonnet, comme le reste de la plateforme.
      model: anthropic("claude-sonnet-5"),
      prompt: buildPlannerPrompt(goal, team, leader.name),
      maxOutputTokens: 2000,
      maxRetries: 1,
    });
    text = res.text;
  } catch (err) {
    // Clé invalide, quota, réseau : on dégrade au lieu d'échouer. Le motif est
    // affiché pour que la cause reste visible et non masquée par le repli.
    const msg = err instanceof Error ? err.message : "erreur inconnue";
    console.error("[orchestration] appel modèle échoué :", msg);
    return degrade(`appel au modèle refusé (${msg})`);
  }

  const parsed = parsePlan(text, new Set(team.map((a) => a.slug)));
  if (!parsed) return degrade("réponse du modèle inexploitable");

  return { ...base, ...parsed, offline: false };
}
