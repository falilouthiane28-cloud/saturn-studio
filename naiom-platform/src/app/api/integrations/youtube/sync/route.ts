import { fetchYouTubeSnapshot } from "@/lib/integrations/youtube";
import { loadTokens } from "@/lib/integrations/google";
import { writeLiveData, readLiveData } from "@/lib/supabase/liveStore";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(req: Request) {
  const tokens = await loadTokens();
  if (!tokens) {
    return Response.json(
      {
        error:
          "Google non connecté. Visitez /api/integrations/google/start pour autoriser l'accès YouTube + Gmail.",
      },
      { status: 412 }
    );
  }

  const url = new URL(req.url);
  const days = Math.min(365, parseInt(url.searchParams.get("days") ?? "30", 10));
  const videos = Math.min(50, parseInt(url.searchParams.get("videos") ?? "20", 10));

  try {
    const snapshot = await fetchYouTubeSnapshot({ days, videos });
    await writeLiveData("youtube", snapshot);
    return Response.json({
      success: true,
      synced: {
        videos: snapshot.videos.length,
        subscribers: snapshot.channel.subscribers,
        viewsInPeriod: snapshot.analytics.totals.views,
      },
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[youtube/sync]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const result = await readLiveData("youtube");
  if (result) {
    return Response.json({ live: true, lastUpdated: result.updatedAt });
  }
  return Response.json({ live: false });
}
