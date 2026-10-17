import { fetchFirefliesMeetings, isFirefliesConfigured } from "@/lib/integrations/fireflies";
import { writeLiveData } from "@/lib/supabase/liveStore";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isFirefliesConfigured()) {
    return Response.json(
      {
        error:
          "FIREFLIES_API_KEY absente. Ajoutez-la dans .env.local puis redémarrez le dev server.",
      },
      { status: 412 }
    );
  }

  const url = new URL(req.url);
  const limit = Math.min(50, parseInt(url.searchParams.get("limit") ?? "10", 10));

  try {
    const meetings = await fetchFirefliesMeetings(limit);
    await writeLiveData("meetings", meetings);
    return Response.json({
      success: true,
      synced: meetings.length,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[fireflies/sync]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return Response.json({
    configured: isFirefliesConfigured(),
    endpoint: "POST /api/integrations/fireflies/sync?limit=10",
  });
}
