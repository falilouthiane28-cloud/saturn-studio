import {
  getWhatsAppStatus,
  sendWhatsAppTemplate,
  sendWhatsAppText,
  WhatsAppError,
} from "@/lib/integrations/whatsapp";
import { composeWhatsAppMessage } from "@/lib/prospection/whatsappMessage";
import { normalizePhone, maskPhone, PhoneError } from "@/lib/prospection/phone";
import { readLeads, updateLead } from "@/lib/prospection/store";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/prospection/contact-whatsapp — ÉTAPE 4 bis · CONTACT WhatsApp
 * body: { leadId, to?, mode?: "template" | "text", message?, templateName?, force? }
 *
 * Nouveau canal, à côté de l'email (/contact). Prise de contact à froid =
 * template approuvé (hors fenêtre 24 h) ; texte libre seulement sur demande
 * explicite (jamais de repli silencieux). Un envoi par lead et par requête.
 */

const LOG = "[prospection/contact-whatsapp]";

// Garde de débit en mémoire (instance unique Docker) : limite le rythme global.
const RATE_PER_MIN = Number(process.env.WHATSAPP_RATE_PER_MIN || 10);
const sendTimestamps: number[] = [];
function rateGuard(): boolean {
  const now = Date.now();
  while (sendTimestamps.length && now - sendTimestamps[0] > 60_000) sendTimestamps.shift();
  if (sendTimestamps.length >= RATE_PER_MIN) return false;
  sendTimestamps.push(now);
  return true;
}

export async function POST(req: Request) {
  try {
    const { leadId, to, mode, message, templateName, force } = (await req.json()) as {
      leadId?: string;
      to?: string;
      mode?: "template" | "text";
      message?: string;
      templateName?: string;
      force?: boolean;
    };

    // 1) lead existe ?
    const lead = (await readLeads()).find((l) => l.id === leadId);
    if (!lead) return Response.json({ error: "Lead introuvable" }, { status: 404 });

    // 2) personnalisation présente ?
    if (!lead.outreach) {
      return Response.json(
        { error: "Générez d'abord le message (étape Personnalisation)." },
        { status: 422 }
      );
    }

    // 3) opt-out ?
    if (lead.whatsappOptOut) {
      return Response.json(
        { error: "Ce prospect a demandé à ne plus être contacté sur WhatsApp." },
        { status: 409 }
      );
    }

    // 4) WhatsApp connecté ?
    if (!getWhatsAppStatus().connected) {
      return Response.json(
        { error: "WhatsApp non connecté — configurez-le dans Connexions." },
        { status: 412 }
      );
    }

    // 5) destinataire normalisable en E.164 ?
    const rawTo = (to || lead.phones?.[0] || lead.phone || "").trim();
    if (!rawTo) {
      return Response.json(
        { error: "Aucun numéro de téléphone pour ce lead — renseignez-en un." },
        { status: 422 }
      );
    }
    let e164: string;
    try {
      e164 = normalizePhone(rawTo).e164;
    } catch (err) {
      const msg = err instanceof PhoneError ? err.message : "Numéro invalide.";
      return Response.json({ error: msg }, { status: 422 });
    }

    // 6) doublon < 24 h ? (sauf force)
    if (!force && lead.whatsapp?.sentAt) {
      const ageMs = Date.now() - new Date(lead.whatsapp.sentAt).getTime();
      if (ageMs < 24 * 60 * 60 * 1000) {
        return Response.json(
          { error: "Un message WhatsApp a déjà été envoyé à ce lead il y a moins de 24 h." },
          { status: 409 }
        );
      }
    }

    // 7) garde de débit
    if (!rateGuard()) {
      return Response.json(
        { error: `Limite de ${RATE_PER_MIN} envois/minute atteinte — réessayez dans un instant.` },
        { status: 429 }
      );
    }

    // 8) envoi (template par défaut pour le froid ; texte seulement si demandé)
    const composed = composeWhatsAppMessage(lead);
    const sendMode: "template" | "text" = mode === "text" ? "text" : "template";
    const previewText = (message ?? composed.text).trim();

    let resultId: string;
    let usedTemplate: string | undefined;

    if (sendMode === "text") {
      const result = await sendWhatsAppText({ to: e164, body: previewText });
      resultId = result.messageId;
    } else {
      const tpl = (templateName || process.env.WHATSAPP_DEFAULT_TEMPLATE || "").trim();
      if (!tpl) {
        return Response.json(
          {
            error:
              "Aucun template WhatsApp approuvé configuré (WHATSAPP_DEFAULT_TEMPLATE) — requis pour une prise de contact à froid.",
          },
          { status: 422 }
        );
      }
      const result = await sendWhatsAppTemplate({
        to: e164,
        templateName: tpl,
        language: process.env.WHATSAPP_TEMPLATE_LANG || "fr",
        variables: composed.templateVariables,
      });
      resultId = result.messageId;
      usedTemplate = tpl;
    }

    const sentAt = new Date().toISOString();
    const updated = await updateLead(lead.id, {
      status: "contacte",
      contactedAt: sentAt,
      contactChannel: "whatsapp",
      outreach: { ...lead.outreach, whatsapp: previewText },
      whatsapp: {
        messageId: resultId,
        sentAt,
        to: e164,
        mode: sendMode,
        ...(usedTemplate ? { templateName: usedTemplate } : {}),
      },
    });

    console.log(`${LOG} envoyé à ${maskPhone(e164)} (mode=${sendMode})`);
    return Response.json({ success: true, lead: updated, sentTo: maskPhone(e164), messageId: resultId });
  } catch (err) {
    if (err instanceof WhatsAppError) {
      console.error(`${LOG} ${err.message}`);
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error(LOG, err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
