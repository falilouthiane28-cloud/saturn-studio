import { getDeliverable } from "@/lib/deliverables";
import type { AgentSlug } from "@/lib/types";
import { AGENT_SLUGS } from "@/lib/agents";

export const runtime = "nodejs";

// Dérivé du registre — pas de seconde liste à maintenir.
const VALID: AgentSlug[] = AGENT_SLUGS;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agent = url.searchParams.get("agent");
  const slug = url.searchParams.get("slug");

  if (!agent || !slug) {
    return Response.json({ error: "Missing agent or slug" }, { status: 400 });
  }
  if (!VALID.includes(agent as AgentSlug)) {
    return Response.json({ error: "Invalid agent" }, { status: 400 });
  }
  // Sécurité : empêche path traversal
  if (slug.includes("/") || slug.includes("..") || slug.includes("\\")) {
    return Response.json({ error: "Invalid slug" }, { status: 400 });
  }

  const result = await getDeliverable(agent as AgentSlug, slug);
  if (!result) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    deliverable: result.deliverable,
    content: result.content,
  });
}
