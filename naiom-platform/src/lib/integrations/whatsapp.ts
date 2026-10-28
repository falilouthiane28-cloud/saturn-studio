/**
 * Intégration WhatsApp Cloud API (Meta Graph API) — natif, sans SDK.
 *
 * Deux chemins d'envoi :
 *   - template : obligatoire pour une prise de contact à froid (hors fenêtre
 *     de 24 h), avec des variables personnalisées {{1}}, {{2}}…
 *   - text     : message libre, autorisé UNIQUEMENT si le prospect nous a
 *     écrit dans les dernières 24 h. Jamais de repli silencieux template→text.
 *
 * Interface conçue derrière de petites fonctions pour qu'un autre fournisseur
 * (Twilio…) puisse être branché plus tard sans toucher aux appelants.
 *
 * Secrets : variables d'environnement uniquement. Jamais en dur, jamais
 * journalisés, jamais renvoyés au client.
 */

const GRAPH_BASE = "https://graph.facebook.com";
const TIMEOUT_MS = 15_000;

function apiVersion(): string {
  return process.env.WHATSAPP_API_VERSION || "v21.0";
}

/** true si le dry-run est actif (tests sans appel à Meta). */
function isDryRun(): boolean {
  return process.env.WHATSAPP_DRY_RUN === "true" || process.env.WHATSAPP_DRY_RUN === "1";
}

/** true si les secrets minimaux sont présents (ou dry-run). */
export function isWhatsAppConfigured(): boolean {
  if (isDryRun()) return true;
  return Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export interface WhatsAppStatus {
  connected: boolean;
  /** ID du numéro expéditeur (public, non secret), pour l'affichage. */
  phoneNumberId?: string;
  dryRun?: boolean;
}

/** État de la connexion — ne renvoie aucun secret. */
export function getWhatsAppStatus(): WhatsAppStatus {
  if (isDryRun()) {
    return { connected: true, phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID, dryRun: true };
  }
  if (!isWhatsAppConfigured()) return { connected: false };
  return { connected: true, phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID };
}

export interface SendResult {
  messageId: string;
  sentAt: string;
}

export interface SendTemplateParams {
  /** Destinataire au format E.164 (sans "+" accepté par Meta aussi). */
  to: string;
  /** Nom du template approuvé par Meta. */
  templateName: string;
  /** Code langue du template, ex. "fr". */
  language: string;
  /** Variables du corps, remplacent {{1}}, {{2}}… dans l'ordre. */
  variables: string[];
}

export interface SendTextParams {
  to: string;
  body: string;
}

/**
 * Erreur d'envoi WhatsApp portant un code HTTP à renvoyer tel quel par la route.
 * `message` est un texte en français prêt à afficher.
 */
export class WhatsAppError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "WhatsAppError";
    this.status = status;
  }
}

/**
 * Traduit un code d'erreur Meta en message FR + statut HTTP.
 * Réf. codes : https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
 */
export function mapMetaError(code: number | undefined, detail: string): WhatsAppError {
  switch (code) {
    case 131026: // Message undeliverable (destinataire pas sur WhatsApp)
    case 131051:
      return new WhatsAppError("Ce numéro n'est pas joignable sur WhatsApp.", 422);
    case 131047: // Re-engagement : hors fenêtre 24 h → template requis
      return new WhatsAppError(
        "Hors de la fenêtre de 24 h : un message libre est refusé, utilisez un template approuvé.",
        409
      );
    case 132000: // Template param mismatch
    case 132001: // Template does not exist / pas approuvé
    case 132005:
    case 132007:
      return new WhatsAppError(
        "Template introuvable ou non approuvé (vérifiez le nom, la langue et les variables).",
        422
      );
    case 190: // Access token expiré / invalide
      return new WhatsAppError("Jeton WhatsApp expiré ou invalide — reconfigurez la connexion.", 412);
    case 80007: // Rate limit
    case 131048:
    case 4:
      return new WhatsAppError("Limite d'envoi WhatsApp atteinte — réessayez plus tard.", 429);
    case 100: // Numéro mal formé / paramètre invalide
      return new WhatsAppError("Numéro de destinataire invalide pour WhatsApp.", 422);
    default:
      return new WhatsAppError(
        `Erreur WhatsApp (code ${code ?? "?"}) : ${detail.slice(0, 180)}`,
        502
      );
  }
}

/** POST vers Graph API avec timeout 15 s et 1 retry sur erreur réseau/5xx. */
async function graphPost(payload: Record<string, unknown>): Promise<SendResult> {
  if (isDryRun()) {
    return { messageId: `dryrun-${Date.now()}`, sentAt: new Date().toISOString() };
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    throw new WhatsAppError("WhatsApp non connecté — configurez-le dans Connexions.", 412);
  }
  const url = `${GRAPH_BASE}/${apiVersion()}/${phoneId}/messages`;

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
        signal: ctrl.signal,
      });
      clearTimeout(t);

      if (res.ok) {
        const data = await res.json();
        const id = data?.messages?.[0]?.id;
        if (!id) throw new WhatsAppError("Réponse WhatsApp inattendue (aucun message id).", 502);
        return { messageId: id, sentAt: new Date().toISOString() };
      }

      // 4xx : erreur définitive, pas de retry. 5xx : retry une fois.
      const text = await res.text();
      let code: number | undefined;
      try {
        code = JSON.parse(text)?.error?.code;
      } catch {
        /* corps non JSON */
      }
      if (res.status >= 500 && attempt === 0) {
        lastErr = new WhatsAppError(`WhatsApp ${res.status}`, 502);
        continue; // retry
      }
      throw mapMetaError(code, text);
    } catch (err) {
      clearTimeout(t);
      if (err instanceof WhatsAppError) throw err;
      // Erreur réseau / abort : retry une fois.
      lastErr = err;
      if (attempt === 0) continue;
      const reason = err instanceof Error ? err.message : "réseau";
      throw new WhatsAppError(`Envoi WhatsApp impossible (${reason}).`, 502);
    }
  }
  const reason = lastErr instanceof Error ? lastErr.message : "réseau";
  throw new WhatsAppError(`Envoi WhatsApp impossible (${reason}).`, 502);
}

/** Envoi d'un message template (prise de contact à froid). */
export async function sendWhatsAppTemplate(p: SendTemplateParams): Promise<SendResult> {
  const components =
    p.variables.length > 0
      ? [
          {
            type: "body",
            parameters: p.variables.map((v) => ({ type: "text", text: v })),
          },
        ]
      : [];
  return graphPost({
    to: p.to,
    type: "template",
    template: {
      name: p.templateName,
      language: { code: p.language },
      ...(components.length ? { components } : {}),
    },
  });
}

/** Envoi d'un message texte libre (fenêtre de 24 h ouverte uniquement). */
export async function sendWhatsAppText(p: SendTextParams): Promise<SendResult> {
  return graphPost({
    to: p.to,
    type: "text",
    text: { preview_url: false, body: p.body },
  });
}
