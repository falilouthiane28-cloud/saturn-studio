"use client";

import { Icon } from "@/components/Icon";
import { PLATFORM_LABEL, TOOL_META } from "@/lib/tools/meta";

/** Part d'outil telle que produite par le SDK (champs utiles seulement). */
export interface ToolPart {
  type: string;
  toolCallId?: string;
  state?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
  approval?: { id: string; approved?: boolean };
}

export function toolPartsOf(parts: { type: string }[]): ToolPart[] {
  return (parts as ToolPart[]).filter((p) => p.type.startsWith("tool-") && TOOL_META[p.type.slice(5)]);
}

export function hasPendingApproval(parts: { type: string }[]): boolean {
  return toolPartsOf(parts).some((p) => p.state === "approval-requested");
}

/**
 * Activité des connecteurs sous une réponse d'agent : une ligne par appel
 * (en cours / fait / échec), et une carte d'approbation pour les actions
 * d'écriture (envoi, publication) — rien ne part sans le clic de l'utilisateur.
 */
export function ToolActivity({
  parts,
  agentName,
  onRespond,
}: {
  parts: { type: string }[];
  agentName: string;
  onRespond: (approvalId: string, approved: boolean) => void;
}) {
  const tools = toolPartsOf(parts);
  if (!tools.length) return null;

  return (
    <div className="tool-activity" role="list" aria-label="Actions de l'agent">
      {tools.map((p, i) => {
        const name = p.type.slice(5);
        const meta = TOOL_META[name];
        const platform = PLATFORM_LABEL[meta.platform];
        const failed = p.state === "output-error" || (typeof p.output === "string" && p.output.startsWith("ÉCHEC"));

        if (p.state === "approval-requested" && p.approval) {
          return (
            <div key={p.toolCallId ?? i} role="listitem" className="tool-approval">
              <div className="tool-approval-head">
                <Icon name="ShieldAlert" size={16} aria-hidden />
                <span>
                  <b>{agentName}</b> demande votre accord : {meta.label.charAt(0).toLowerCase() + meta.label.slice(1)} ({platform})
                </span>
              </div>
              <dl className="tool-approval-body">
                {Object.entries(p.input ?? {}).map(([k, v]) => (
                  <div key={k}>
                    <dt>{FIELD_LABEL[k] ?? k}</dt>
                    <dd>{String(v)}</dd>
                  </div>
                ))}
              </dl>
              <div className="tool-approval-actions">
                <button type="button" className="tool-btn tool-btn--primary" onClick={() => onRespond(p.approval!.id, true)}>
                  <Icon name="Check" size={15} aria-hidden /> Approuver
                </button>
                <button type="button" className="tool-btn" onClick={() => onRespond(p.approval!.id, false)}>
                  Refuser
                </button>
              </div>
            </div>
          );
        }

        let icon = "Loader";
        let text = `${meta.label}`;
        let cls = "is-running";
        if (p.state === "output-available" && !failed) { icon = "Check"; cls = "is-done"; }
        else if (failed) { icon = "AlertCircle"; cls = "is-error"; text = `${meta.label} — échec`; }
        else if (p.state === "output-denied") { icon = "X"; cls = "is-denied"; text = `${meta.label} — refusé`; }
        else if (p.state === "approval-responded") { text = `${meta.label} — approuvé, en cours…`; }
        else { text = `${meta.label} — en cours…`; }

        return (
          <div key={p.toolCallId ?? i} role="listitem" className={`tool-chip ${cls}`}>
            <Icon name={icon} size={14} className={cls === "is-running" ? "tool-spin" : undefined} aria-hidden />
            <span>{text}</span>
            <span className="tool-chip-platform">{platform}</span>
          </div>
        );
      })}
    </div>
  );
}

const FIELD_LABEL: Record<string, string> = {
  to: "Destinataire",
  subject: "Objet",
  body: "Message",
  text: "Texte du post",
  caption: "Légende",
  media_url: "Média",
  media_type: "Format",
};
