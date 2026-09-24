import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { PATHS, DELIVERABLE_FOLDERS } from "./paths";
import type { AgentMeta, AgentSlug } from "./types";

/**
 * ============================================================
 * SOURCE UNIQUE DE VÉRITÉ — les six agents de Saturn Studio
 * ------------------------------------------------------------
 * Un agent n'existe que s'il a un module `.claude/agents/<slug>.md`.
 * Cette table et `AgentSlug` doivent rester alignées sur ce dossier :
 * toute entrée sans `.md` donnerait un agent sans system prompt, donc
 * ouvrable mais muet — c'est ce qui avait produit huit agents fantômes.
 *
 * L'ordre du tableau est l'ordre d'affichage partout dans l'app
 * (studio, page équipe, sidebar, rangée d'avatars du hero).
 * ============================================================
 */
const AGENTS = [
  {
    slug: "fireflies",
    name: "Ousmane",
    role: "Analyste de calls",
    icon: "Mic",
    accent: "nude",
    tagline: "Analyse de calls + plan d'action équipe.",
  },
  {
    slug: "prospection",
    name: "Awa",
    role: "Agent prospection",
    icon: "Radar",
    accent: "marine",
    tagline:
      "Détecte, enrichit et contacte vos prospects — pipeline rempli la nuit.",
  },
  {
    slug: "proposition",
    name: "Cheikh",
    role: "Proposition commerciale",
    icon: "FileSignature",
    accent: "marine",
    tagline:
      "Reprend le call analysé → proposition commerciale PDF envoyée au prospect.",
  },
  {
    slug: "createur-contenu",
    name: "Léa",
    role: "Créateur de contenu",
    icon: "PenLine",
    accent: "nude",
    tagline: "Posts LinkedIn, Reels, scripts YouTube, emails.",
  },
  {
    slug: "veille",
    name: "Nina",
    role: "Veille tendances",
    icon: "TrendingUp",
    accent: "nude",
    tagline:
      "Reels Instagram les plus vus d'un hashtag + script de chaque vidéo.",
  },
  {
    slug: "ecommerce",
    name: "Emma",
    role: "Agente e-commerce",
    icon: "ShoppingBag",
    accent: "nude",
    tagline: "Vidéos produit avec avatars IA (Arcads), prêtes à publier.",
  },
] as const satisfies readonly {
  slug: AgentSlug;
  name: string;
  role: string;
  icon: string;
  accent: AgentMeta["accent"];
  tagline: string;
}[];

/** Les six slugs, dans l'ordre d'affichage. */
export const AGENT_SLUGS: AgentSlug[] = AGENTS.map((a) => a.slug);

/** Nombre d'agents réels — à utiliser partout plutôt qu'un chiffre en dur. */
export const AGENT_COUNT = AGENTS.length;

/**
 * Chef d'équipe — déclaré dans `agentsUI` (module sans `fs`) et ré-exporté ici
 * pour les appelants serveur. Le badge côté client importe `agentsUI`.
 */
export { TEAM_LEADER_SLUG, isTeamLeader } from "./agentsUI";

async function loadAgentFromMarkdown(
  slug: AgentSlug
): Promise<{ systemPrompt: string; model: string; tools: string[] } | null> {
  const filePath = path.join(PATHS.agents, `${slug}.md`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const { data, content } = matter(raw);
    const tools =
      typeof data.tools === "string"
        ? data.tools
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean)
        : Array.isArray(data.tools)
        ? data.tools
        : [];
    return {
      systemPrompt: content.trim(),
      model: (data.model as string) ?? "sonnet",
      tools,
    };
  } catch {
    return null;
  }
}

/**
 * Les six agents, prompts chargés depuis leurs modules.
 *
 * C'est la SEULE fonction de listage : studio, page équipe, sidebar et hero
 * tapent tous ici. Un agent retiré de `AGENTS` disparaît donc partout en même
 * temps — pas de grille à trous, pas de route morte.
 */
export async function listAgents(): Promise<AgentMeta[]> {
  const agents: AgentMeta[] = await Promise.all(
    AGENTS.map(async (cfg) => {
      const data = await loadAgentFromMarkdown(cfg.slug);
      return {
        slug: cfg.slug,
        name: cfg.name,
        role: cfg.role,
        tagline: cfg.tagline,
        model: data?.model ?? "sonnet",
        tools: data?.tools ?? [],
        status: "active" as const,
        accent: cfg.accent,
        icon: cfg.icon,
        systemPrompt: data?.systemPrompt ?? "",
        deliverableFolder: DELIVERABLE_FOLDERS[cfg.slug]?.rel,
      };
    })
  );

  // MODE TEMPLATE (offre séparée) : si OWNED_AGENT est défini, seul cet agent
  // est débloqué ; les autres passent "locked".
  const owned = process.env.OWNED_AGENT?.trim();
  if (owned) {
    for (const a of agents) a.status = a.slug === owned ? "active" : "locked";
  }
  return agents;
}

/** L'agent débloqué de ce template (ou null sur la plateforme complète). */
export function ownedSlug(): string | null {
  return process.env.OWNED_AGENT?.trim() || null;
}

export async function getAgentBySlug(slug: string): Promise<AgentMeta | null> {
  const all = await listAgents();
  return all.find((a) => a.slug === slug) ?? null;
}
