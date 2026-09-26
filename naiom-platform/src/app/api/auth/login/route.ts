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

function back(req: NextRequest, next: string, error: string) {
  const url = new URL("/login", req.url);
  url.searchParams.set("next", next);
  url.searchParams.set("error", error);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const next = safeNext(String(form.get("next") ?? ""));
  const ip = clientIp(req);
  const now = Date.now();

  const rec = fails.get(ip);
  if (rec && now - rec.since < WINDOW_MS && rec.n >= MAX_FAILS) return back(req, next, "locked");

  if (!checkPassword(String(form.get("password") ?? ""))) {
    const fresh = !rec || now - rec.since >= WINDOW_MS;
    fails.set(ip, { n: fresh ? 1 : rec.n + 1, since: fresh ? now : rec.since });
    await new Promise((r) => setTimeout(r, 600));
    return back(req, next, "invalid");
  }

  fails.delete(ip);
  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: req.headers.get("x-forwarded-proto") === "https" || req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}
