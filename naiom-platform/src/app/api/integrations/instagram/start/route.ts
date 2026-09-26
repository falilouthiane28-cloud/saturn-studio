import { NextResponse } from "next/server";
import { newOAuthState } from "@/lib/integrations/linkedin";
import { buildInstagramAuthUrl, isInstagramConfigured } from "@/lib/integrations/instagramPublish";

export const runtime = "nodejs";

/** GET /api/integrations/instagram/start → écran de consentement Instagram. */
export async function GET(req: Request) {
  if (!isInstagramConfigured()) {
    return NextResponse.json(
      { error: "INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET / INSTAGRAM_REDIRECT_URI manquants dans .env.local" },
      { status: 412 }
    );
  }
  const state = newOAuthState();
  const res = NextResponse.redirect(buildInstagramAuthUrl(state));
  // Anti-CSRF : le state revient dans le callback et doit correspondre à ce cookie.
  res.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.headers.get("x-forwarded-proto") === "https",
    path: "/api/integrations/instagram",
    maxAge: 600,
  });
  return res;
}
