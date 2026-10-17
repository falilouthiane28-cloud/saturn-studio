import { fetchRecentDriveFiles } from "@/lib/integrations/drive";
import { loadTokens } from "@/lib/integrations/google";
import { writeLiveData } from "@/lib/supabase/liveStore";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const tokens = await loadTokens();
  if (!tokens) {
    return Response.json(
      { error: "Google non connecté. Passez d'abord par /api/integrations/google/start." },
      { status: 412 }
    );
  }

  const url = new URL(req.url);
  const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "30", 10));

  try {
    const snap = await fetchRecentDriveFiles(limit);
    await writeLiveData("drive", snap);
    return Response.json({
      success: true,
      synced: snap.files.length,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[drive/sync]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}
