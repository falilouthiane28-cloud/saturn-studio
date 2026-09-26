import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_DAYS,
  checkPassword,
  createSessionToken,
  safeNext,
} from "@/lib/auth/session";

// Anti force brute : 5 essais ratés par IP sur 15 min (mémoire du process,
// suffisant pour un seul conteneur).
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;
const fails = new Map<string, { n: number; since: number }>();

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

/* Redirections RELATIVES : derrière Caddy, req.url vaut http://localhost:3000
   et une URL absolue enverrait le navigateur sur localhost. */
function seeOther(location: string) {
  return new NextResponse(null, { status: 303, headers: { Location: location } });
}

function back(next: string, error: string) {
  return seeOther(`/login?${new URLSearchParams({ next, error })}`);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const next = safeNext(String(form.get("next") ?? ""));
  const ip = clientIp(req);
  const now = Date.now();

  const rec = fails.get(ip);
  if (rec && now - rec.since < WINDOW_MS && rec.n >= MAX_FAILS) return back(next, "locked");

  if (!checkPassword(String(form.get("password") ?? ""))) {
    const fresh = !rec || now - rec.since >= WINDOW_MS;
    fails.set(ip, { n: fresh ? 1 : rec.n + 1, since: fresh ? now : rec.since });
    await new Promise((r) => setTimeout(r, 600));
    return back(next, "invalid");
  }

  fails.delete(ip);
  const res = seeOther(next);
  res.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
