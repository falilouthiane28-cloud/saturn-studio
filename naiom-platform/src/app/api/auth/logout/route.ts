import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// POST uniquement : un simple lien (ou un prefetch) ne doit pas déconnecter.
export async function POST() {
  // Relatif : derrière le proxy, req.url pointe sur localhost.
  const res = new NextResponse(null, { status: 303, headers: { Location: "/" } });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
