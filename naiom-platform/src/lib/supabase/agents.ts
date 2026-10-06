import { supabaseAdmin } from "./server";
import type { Agent, AgentInteraction, AgentDeliverable, AgentFeedback, Json } from "./types";

export async function getAgent(agentId: string): Promise<Agent | null> {
  const { data } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .single();
  return data;
}

export async function listAgents(): Promise<Agent[]> {
  const { data } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}

export async function saveInteraction(
  agentId: string,
  sessionId: string,
  role: string,
  content: string,
  meta?: { tokensIn?: number; tokensOut?: number; latencyMs?: number; model?: string; metadata?: Record<string, Json | undefined> }
): Promise<AgentInteraction | null> {
  const { data } = await supabaseAdmin
    .from("agent_interactions")
    .insert({
      agent_id: agentId,
      session_id: sessionId,
      role,
      content,
      tokens_in: meta?.tokensIn ?? 0,
      tokens_out: meta?.tokensOut ?? 0,
      latency_ms: meta?.latencyMs ?? null,
      model_used: meta?.model ?? null,
      metadata: (meta?.metadata ?? {}) as Json,
    })
    .select()
    .single();
  return data;
}

export async function getSessionHistory(sessionId: string): Promise<AgentInteraction[]> {
  const { data } = await supabaseAdmin
    .from("agent_interactions")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at");
  return data ?? [];
}

export async function saveDeliverable(
  agentId: string,
  type: string,
  content: Record<string, Json | undefined>,
  opts?: { sessionId?: string; title?: string; status?: string; platform?: string; outputUrl?: string }
): Promise<AgentDeliverable | null> {
  const { data } = await supabaseAdmin
    .from("agent_deliverables")
    .insert({
      agent_id: agentId,
      session_id: opts?.sessionId ?? null,
      type,
      title: opts?.title ?? null,
      content: content as Json,
      status: opts?.status ?? "draft",
      platform: opts?.platform ?? null,
      output_url: opts?.outputUrl ?? null,
      metadata: {} as Json,
    })
    .select()
    .single();
  return data;
}

export async function listDeliverables(agentId: string, limit = 50): Promise<AgentDeliverable[]> {
  const { data } = await supabaseAdmin
    .from("agent_deliverables")
    .select("*")
    .eq("agent_id", agentId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function updateDeliverableStatus(
  id: string,
  status: string,
  outputUrl?: string
): Promise<void> {
  await supabaseAdmin
    .from("agent_deliverables")
    .update({
      status,
      output_url: outputUrl ?? undefined,
      published_at: status === "published" ? new Date().toISOString() : undefined,
    })
    .eq("id", id);
}

export async function saveFeedback(
  agentId: string,
  feedbackType: string,
  opts?: { interactionId?: string; deliverableId?: string; rating?: number; comment?: string; correction?: Record<string, Json | undefined> }
): Promise<void> {
  await supabaseAdmin.from("agent_feedback").insert({
    agent_id: agentId,
    interaction_id: opts?.interactionId ?? null,
    deliverable_id: opts?.deliverableId ?? null,
    feedback_type: feedbackType,
    rating: opts?.rating ?? null,
    comment: opts?.comment ?? null,
    correction: (opts?.correction ?? null) as Json | null,
  });
}

export async function trackMetric(
  agentId: string,
  metric: string,
  value: number,
  periodStart: Date,
  periodEnd: Date,
  dimensions?: Record<string, Json | undefined>
): Promise<void> {
  await supabaseAdmin.from("agent_analytics").insert({
    agent_id: agentId,
    metric,
    value,
    period_start: periodStart.toISOString(),
    period_end: periodEnd.toISOString(),
    dimensions: (dimensions ?? {}) as Json,
  });
}
