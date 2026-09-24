import type { AgentSlug } from "@/lib/types";

/** État d'une tâche dans le plan. */
export type TaskStatus = "en-attente" | "en-cours" | "terminé" | "échec";

/**
 * Une tâche confiée à un agent par le chef d'équipe.
 *
 * `dependsOn` porte le passage de relais : une tâche qui dépend d'une autre
 * reçoit le livrable de celle-ci en entrée. C'est ce qui permet à Cheikh de
 * partir de l'analyse d'Ousmane plutôt que de zéro, exactement comme son
 * prompt métier le décrit déjà.
 */
export interface OrchestrationTask {
  id: string;
  agentSlug: AgentSlug;
  /** Intitulé court, lisible dans le tableau. */
  title: string;
  /** Consigne transmise à l'agent. */
  brief: string;
  /** ids des tâches dont le livrable alimente celle-ci. */
  dependsOn: string[];
  status: TaskStatus;
  /** Livrable produit, une fois la tâche exécutée. */
  output?: string;
}

/** Plan complet produit par le chef d'équipe à partir d'un objectif. */
export interface OrchestrationPlan {
  goal: string;
  leader: AgentSlug;
  /** Une ligne expliquant la découpe retenue. */
  rationale: string;
  tasks: OrchestrationTask[];
  createdAt: string;
  /** true si le plan vient du gabarit local et non du chef d'équipe. */
  offline: boolean;
  /** Pourquoi, le cas échéant — affiché tel quel à l'utilisateur. */
  offlineReason?: string;
}
