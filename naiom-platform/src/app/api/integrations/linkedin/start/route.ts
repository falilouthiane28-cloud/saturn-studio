import { NextResponse } from "next/server";
import { buildLinkedInAuthUrl, isLinkedInConfigured, newOAuthState } from "@/lib/integrations/linkedin";

export const runtime = "nodejs";

/** GET /api/integrations/linkedin/start → écran de consentement LinkedIn. */
export async function GET(req: Request) {
  if (!isLinkedInConfigured()) {
    return NextResponse.json(
      { error: "LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET / LINKEDIN_REDIRECT_URI manquants dans .env.local" },
      { status: 412 }
    );
  }
  const state = newOAuthState();
  const res = NextResponse.redirect(buildLinkedInAuthUrl(state));
  // Anti-CSRF : le state revient dans le callback et doit correspondre à ce cookie.
  res.cookies.set("li_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.headers.get("x-forwarded-proto") === "https",
    path: "/api/integrations/linkedin",
    maxAge: 600,
  });
  return res;
}
