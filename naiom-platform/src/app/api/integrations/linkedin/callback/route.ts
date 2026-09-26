import { NextResponse, type NextRequest } from "next/server";
import { exchangeLinkedInCode, saveLinkedInTokens } from "@/lib/integrations/linkedin";

export const runtime = "nodejs";

/* Redirection relative : derrière Caddy, req.url pointe sur localhost. */
function toSettings(query: string) {
  const res = new NextResponse(null, { status: 303, headers: { Location: `/settings?${query}` } });
  res.cookies.set("li_oauth_state", "", { path: "/api/integrations/linkedin", maxAge: 0 });
  return res;
}

/** GET /api/integrations/linkedin/callback?code&state */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const err = p.get("error_description") ?? p.get("error");
  if (err) return toSettings(`linkedin_error=${encodeURIComponent(err)}`);

  const state = p.get("state");
  if (!state || state !== req.cookies.get("li_oauth_state")?.value) {
    return toSettings("linkedin_error=state_invalide");
  }
  const code = p.get("code");
  if (!code) return toSettings("linkedin_error=code_manquant");

  try {
    await saveLinkedInTokens(await exchangeLinkedInCode(code));
    return toSettings("linkedin=connected");
  } catch (e) {
    return toSettings(`linkedin_error=${encodeURIComponent(e instanceof Error ? e.message : "échange_impossible")}`);
  }
}
