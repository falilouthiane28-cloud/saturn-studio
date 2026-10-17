import { fetchGmailInbox } from "@/lib/integrations/gmail";
import { loadTokens } from "@/lib/integrations/google";
import { writeLiveData } from "@/lib/supabase/liveStore";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request) {
  const tokens = await loadTokens();
  if (!tokens) {
    return Response.json(
      { error: "Google non connecté. Passez d'abord par /api/integrations/google/start." },
      { status: 412 }
    );
  }

  const url = new URL(req.url);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "20", 10));

  try {
    const emails = await fetchGmailInbox(limit);
    await writeLiveData("inbox", emails);
    return Response.json({
      success: true,
      synced: emails.length,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[gmail/sync]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
