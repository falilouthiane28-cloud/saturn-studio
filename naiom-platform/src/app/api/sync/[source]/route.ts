import { LIVE_SOURCES, type LiveSource } from "@/lib/dataSources";
import { writeLiveData, readLiveData, deleteLiveData } from "@/lib/supabase/liveStore";

export const runtime = "nodejs";

function isValidSource(s: string): s is LiveSource {
  return s in LIVE_SOURCES;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params;

  if (!isValidSource(source)) {
    return Response.json(
      { error: `Source invalide. Utilisez inbox, meetings ou candidates.` },
      { status: 400 }
    );
  }

  const expectedSecret = process.env.SYNC_SECRET;
  if (expectedSecret) {
    const provided = req.headers.get("x-sync-secret");
    if (provided !== expectedSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  if (source === "inbox" || source === "meetings") {
    if (!Array.isArray(payload)) {
      return Response.json(
        { error: `Pour ${source}, le payload doit être un array` },
        { status: 400 }
      );
    }
  } else if (source === "candidates") {
    const p = payload as { candidates?: unknown; jobs?: unknown };
    if (!p || typeof p !== "object" || !Array.isArray(p.candidates) || !Array.isArray(p.jobs)) {
      return Response.json(
        { error: `Pour candidates, le payload doit avoir { candidates: [], jobs: [] }` },
        { status: 400 }
      );
    }
  }

  try {
    await writeLiveData(source, payload);
    return Response.json({
      success: true,
      source,
      receivedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/sync]", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Erreur écriture" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params;

  if (!isValidSource(source)) {
    return Response.json({ error: "Source invalide" }, { status: 400 });
  }

  const expectedSecret = process.env.SYNC_SECRET;
  if (expectedSecret) {
    const provided = req.headers.get("x-sync-secret");
    if (provided !== expectedSecret) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    await deleteLiveData(source);
    return Response.json({ success: true, source, reset: "mock" });
  } catch {
    return Response.json({ success: true, source, reset: "already mock" });
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ source: string }> }
) {
  const { source } = await params;

  if (!isValidSource(source)) {
    return Response.json({ error: "Source invalide" }, { status: 400 });
  }

  const result = await readLiveData(source);
  if (result) {
    return Response.json({
      source,
      live: true,
      lastUpdated: result.updatedAt,
    });
  }
  return Response.json({ source, live: false });
}
