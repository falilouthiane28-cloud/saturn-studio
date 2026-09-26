import { NextResponse, type NextRequest } from "next/server";
import { exchangeInstagramCode, saveInstagramTokens } from "@/lib/integrations/instagramPublish";

export const runtime = "nodejs";

/* Redirection relative : derrière Caddy, req.url pointe sur localhost. */
function toSettings(query: string) {
  const res = new NextResponse(null, { status: 303, headers: { Location: `/settings?${query}` } });
  res.cookies.set("ig_oauth_state", "", { path: "/api/integrations/instagram", maxAge: 0 });
  return res;
}

/** GET /api/integrations/instagram/callback?code&state */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const err = p.get("error_description") ?? p.get("error");
  if (err) return toSettings(`instagram_error=${encodeURIComponent(err)}`);

  const state = p.get("state");
  if (!state || state !== req.cookies.get("ig_oauth_state")?.value) {
    return toSettings("instagram_error=state_invalide");
  }
  const code = p.get("code");
  if (!code) return toSettings("instagram_error=code_manquant");

  try {
    await saveInstagramTokens(await exchangeInstagramCode(code));
    return toSettings("instagram=connected");
  } catch (e) {
    return toSettings(`instagram_error=${encodeURIComponent(e instanceof Error ? e.message : "échange_impossible")}`);
  }
}
