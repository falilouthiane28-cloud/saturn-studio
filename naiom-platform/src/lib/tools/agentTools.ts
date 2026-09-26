import { promises as fs } from "node:fs";
import path from "node:path";
import { jsonSchema, tool, type ToolSet } from "ai";
import { PATHS } from "@/lib/paths";
import { AGENT_TOOLS, TOOL_BY_NAME, type ToolDef } from "@/lib/tools/registry";

const MAX_OUTPUT_CHARS = 12_000;
const LOG_FILE = path.join(PATHS.analytics, "tools", "tool-calls.jsonl");

/** Paramètres tronqués pour le journal (jamais les résultats : données personnelles). */
function trimArgs(args: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).map(([k, v]) => [k, typeof v === "string" && v.length > 120 ? `${v.slice(0, 120)}…` : v])
  );
}

async function logCall(entry: Record<string, unknown>) {
  try {
    await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
    await fs.appendFile(LOG_FILE, JSON.stringify(entry) + "\n", "utf8");
  } catch (e) {
    console.error("[tools] journal indisponible :", e);
  }
}

function capOutput(result: unknown): string {
  const text = typeof result === "string" ? result : JSON.stringify(result);
  return text.length > MAX_OUTPUT_CHARS ? `${text.slice(0, MAX_OUTPUT_CHARS)}\n[… tronqué]` : text;
}

function wrap(agentSlug: string, def: ToolDef) {
  return tool({
    description: def.kind === "write" ? `${def.description} (Action soumise à l'approbation de l'utilisateur.)` : def.description,
    inputSchema: jsonSchema<Record<string, unknown>>(def.parameters as Parameters<typeof jsonSchema>[0]),
    needsApproval: def.kind === "write",
    execute: async (args) => {
      const started = Date.now();
      const base = { ts: new Date().toISOString(), agent: agentSlug, tool: def.name, platform: def.platform, kind: def.kind, args: trimArgs(args) };
      try {
        const out = capOutput(await def.run(args));
        await logCall({ ...base, ok: true, ms: Date.now() - started });
        return out;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await logCall({ ...base, ok: false, ms: Date.now() - started, error: message.slice(0, 300) });
        // Rendu au modèle comme résultat : il peut expliquer l'échec au lieu d'inventer.
        return `ÉCHEC de l'outil ${def.name} : ${message}. N'invente aucune donnée : explique le problème à l'utilisateur.`;
      }
    },
  });
}

/** Outils exposés à un agent donné (vide si l'agent n'a aucun connecteur). */
export function toolsForAgent(agentSlug: string): ToolSet {
  const names = AGENT_TOOLS[agentSlug] ?? [];
  return Object.fromEntries(
    names.flatMap((n) => {
      const def = TOOL_BY_NAME.get(n);
      return def ? [[n, wrap(agentSlug, def)]] : [];
    })
  );
}

/** Consigne ajoutée au prompt système : liste des connecteurs disponibles. */
export function toolsInstruction(agentSlug: string): string {
  const defs = (AGENT_TOOLS[agentSlug] ?? []).map((n) => TOOL_BY_NAME.get(n)).filter(Boolean) as ToolDef[];
  if (!defs.length) return "";
  const lines = defs.map((d) => `- \`${d.name}\` — ${d.label}${d.kind === "write" ? " (**soumis à approbation**)" : ""}`);
  return `

---

## Tes connecteurs (données réelles)

${lines.join("\n")}

Règles :
1. Dès qu'une demande porte sur des données réelles (performances, tendances, emails, calls, fichiers), **appelle l'outil** plutôt que de supposer.
2. Si un outil échoue, dis-le clairement et n'invente jamais de chiffres.
3. Cite les liens (url) renvoyés par les outils dans ta réponse.
4. Un outil « soumis à approbation » n'agit qu'après validation de l'utilisateur : prépare une action complète et définitive avant de l'appeler.`;
}
