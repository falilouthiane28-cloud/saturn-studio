"use client";

import { useState } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { Icon } from "@/components/Icon";
import type { OrchestrationPlan } from "@/lib/orchestration/types";
import type { AgentMeta } from "@/lib/types";

interface Props {
  agents: AgentMeta[];
  leaderSlug: string;
}

type State =
  | { kind: "repos" }
  | { kind: "chargement" }
  | { kind: "erreur"; message: string }
  | { kind: "plan"; plan: OrchestrationPlan };

/**
 * Vue d'orchestration : on saisit un objectif, le chef d'équipe le découpe et
 * le tableau montre qui fait quoi et dans quel ordre.
 *
 * Le parti pris de lecture est la CHAÎNE : les tâches sont empilées
 * verticalement dans l'ordre d'exécution, et chaque dépendance est nommée
 * explicitement (« reprend le livrable de … »). Un graphe en boîtes-et-flèches
 * serait plus spectaculaire mais moins lisible à cette échelle, et illisible
 * sur mobile.
 */
export function OrchestrationBoard({ agents, leaderSlug }: Props) {
  const [goal, setGoal] = useState("");
  const [state, setState] = useState<State>({ kind: "repos" });

  const leader = agents.find((a) => a.slug === leaderSlug) ?? agents[0];
  const bySlug = new Map(agents.map((a) => [a.slug, a]));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (goal.trim().length < 8) return;
    setState({ kind: "chargement" });
    try {
      const res = await fetch("/api/orchestration/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: "erreur", message: data.error ?? "Échec du plan." });
        return;
      }
      setState({ kind: "plan", plan: data as OrchestrationPlan });
    } catch {
      setState({
        kind: "erreur",
        message: "Le serveur n'a pas répondu. Vérifiez votre connexion.",
      });
    }
  }

  return (
    <section
      className="rounded-[24px] border p-6 sm:p-8"
      style={{ background: "var(--surface-2)", borderColor: "var(--line-1)" }}
      aria-labelledby="orchestration-titre"
    >
      {/* --- En-tête : qui dirige --- */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <AgentAvatar slug={leader.slug} size={56} name={leader.name} ring />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="orchestration-titre"
              className="text-[22px] leading-tight"
              style={{ fontFamily: "var(--font-serif)", color: "var(--text-1)" }}
            >
              {leader.name}
              {" coordonne l’équipe"}
            </h2>
            <LeaderBadge />
          </div>
          <p className="mt-1 text-[13px]" style={{ color: "var(--text-2)" }}>
            Donnez un objectif : il le découpe et le confie aux bons agents.
          </p>
        </div>
      </div>

      {/* --- Saisie de l'objectif --- */}
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="goal" className="sr-only">
          Objectif à confier à l&apos;équipe
        </label>
        <input
          id="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Ex. : décrocher 5 rendez-vous qualifiés avec des PME industrielles"
          className="min-w-0 flex-1 rounded-[12px] border px-4 text-sm"
          style={{
            minHeight: 44,
            background: "var(--surface-0)",
            borderColor: "var(--line-1)",
            color: "var(--text-1)",
          }}
        />
        <button
          type="submit"
          className="ds-btn ds-btn-primary"
          disabled={state.kind === "chargement" || goal.trim().length < 8}
        >
          {state.kind === "chargement" ? "Répartition…" : "Répartir"}
          <Icon name="GitBranch" size={15} />
        </button>
      </form>

      <div className="mt-6">
        {state.kind === "repos" && <EmptyState agents={agents} />}
        {state.kind === "chargement" && <LoadingState leaderName={leader.name} />}
        {state.kind === "erreur" && <ErrorState message={state.message} />}
        {state.kind === "plan" && (
          <PlanView plan={state.plan} bySlug={bySlug} />
        )}
      </div>
    </section>
  );
}

/* ================= Badge chef d'équipe ================= */

/** Réutilisable : marque l'agent qui coordonne, sur sa carte comme ici. */
export function LeaderBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]"
      style={{
        background: "var(--color-primary-soft)",
        color: "var(--color-primary-strong)",
      }}
      title="Reçoit l'objectif, le découpe et consolide les livrables"
    >
      <Icon name="Crown" size={12} aria-hidden />
      {compact ? "Chef" : "Chef d'équipe"}
    </span>
  );
}

/* ================= États ================= */

function EmptyState({ agents }: { agents: AgentMeta[] }) {
  return (
    <div
      className="rounded-[16px] border border-dashed px-5 py-8 text-center"
      style={{ borderColor: "var(--line-2)" }}
    >
      <div className="mb-4 flex items-center justify-center -space-x-2">
        {agents.map((a) => (
          <span key={a.slug} style={{ boxShadow: "0 0 0 2px var(--surface-2)" }} className="rounded-full">
            <AgentAvatar slug={a.slug} size={34} name={a.name} />
          </span>
        ))}
      </div>
      <p className="text-sm" style={{ color: "var(--text-2)" }}>
        Aucun plan pour le moment.
      </p>
      <p className="mt-1 text-[13px]" style={{ color: "var(--text-3)" }}>
        Décrivez un objectif ci-dessus pour voir l&apos;équipe se répartir le travail.
      </p>
    </div>
  );
}

function LoadingState({ leaderName }: { leaderName: string }) {
  return (
    <div
      className="rounded-[16px] border px-5 py-8 text-center"
      style={{ borderColor: "var(--line-1)" }}
      role="status"
      aria-live="polite"
    >
      <p className="text-sm" style={{ color: "var(--text-2)" }}>
        {leaderName} découpe l&apos;objectif et choisit les agents…
      </p>
      <div className="mx-auto mt-4 flex max-w-[320px] flex-col gap-2" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="ds-skeleton block h-11 rounded-[12px]"
            style={{ animationDelay: `${i * 120}ms` }}
          />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-3 rounded-[16px] px-5 py-4"
      style={{ background: "var(--err-soft)", color: "var(--err)" }}
      role="alert"
    >
      <Icon name="TriangleAlert" size={17} aria-hidden />
      <p className="text-sm">{message}</p>
    </div>
  );
}

/* ================= Le plan ================= */

function PlanView({
  plan,
  bySlug,
}: {
  plan: OrchestrationPlan;
  bySlug: Map<string, AgentMeta>;
}) {
  const titleOf = (id: string) =>
    plan.tasks.find((t) => t.id === id)?.title ?? id;

  return (
    <div>
      <p className="mb-5 text-[13px] italic" style={{ color: "var(--text-2)" }}>
        {plan.rationale}
      </p>

      {plan.offline && (
        <div
          className="mb-5 flex items-start gap-3 rounded-[12px] px-4 py-3 text-[13px]"
          style={{ background: "var(--warn-soft)", color: "var(--warn)" }}
          role="status"
        >
          <Icon name="Info" size={16} aria-hidden />
          <span>
            Plan de repli affiché : {plan.offlineReason}. La répartition
            ci-dessous suit la chaîne décrite par les modules métier, mais elle
            n&apos;a pas été raisonnée par {" "}
            <strong>le chef d&apos;équipe</strong>.
          </span>
        </div>
      )}

      <ol className="flex flex-col gap-3">
        {plan.tasks.map((task, i) => {
          const agent = bySlug.get(task.agentSlug);
          if (!agent) return null;
          return (
            <li key={task.id}>
              {/* Le relais est écrit, pas seulement suggéré par la position. */}
              {task.dependsOn.length > 0 && (
                <div
                  className="mb-2 flex items-center gap-2 ps-4 text-[12px]"
                  style={{ color: "var(--text-3)" }}
                >
                  <Icon name="CornerDownRight" size={13} aria-hidden />
                  reprend le livrable de&nbsp;
                  <strong style={{ color: "var(--text-2)" }}>
                    {task.dependsOn.map(titleOf).join(", ")}
                  </strong>
                </div>
              )}

              <article
                className="flex flex-wrap items-start gap-4 rounded-[16px] border p-4"
                style={{
                  background: "var(--surface-0)",
                  borderColor: "var(--line-1)",
                }}
              >
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold"
                  style={{
                    background: "var(--color-primary-soft)",
                    color: "var(--color-primary-strong)",
                  }}
                  aria-hidden
                >
                  {i + 1}
                </span>

                <AgentAvatar slug={agent.slug} size={40} name={agent.name} />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-[15px] font-semibold"
                      style={{ color: "var(--text-1)" }}
                    >
                      {agent.name}
                    </span>
                    <span
                      className="text-[11px] uppercase tracking-[0.1em]"
                      style={{ color: "var(--text-3)" }}
                    >
                      {agent.role}
                    </span>
                  </div>
                  <p
                    className="mt-1 text-sm font-medium"
                    style={{ color: "var(--text-1)" }}
                  >
                    {task.title}
                  </p>
                  <p className="mt-1 text-[13px]" style={{ color: "var(--text-2)" }}>
                    {task.brief}
                  </p>
                </div>

                <a
                  href={`/agents/${agent.slug}`}
                  className="ds-btn ds-btn-ghost"
                  aria-label={`Ouvrir ${agent.name} pour lancer : ${task.title}`}
                >
                  Lancer
                  <Icon name="ArrowRight" size={14} aria-hidden />
                </a>
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
