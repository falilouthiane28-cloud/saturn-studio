import { getWhatsAppStatus } from "@/lib/integrations/whatsapp";

export const runtime = "nodejs";

/**
 * GET /api/integrations/whatsapp/status
 * État de la connexion WhatsApp pour l'UI. N'expose jamais de secret
 * (ni le jeton, ni le business account id) — seulement connected + phoneNumberId.
 */
export async function GET() {
  const s = getWhatsAppStatus();
  return Response.json({
    connected: s.connected,
    phoneNumberId: s.phoneNumberId,
    dryRun: s.dryRun ?? false,
  });
}
