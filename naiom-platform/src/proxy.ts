import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authEnabled, verifySessionToken } from "@/lib/auth/session";

/**
 * Garde d'accès : l'accueil (vitrine) et la page de connexion sont publics,
 * tout le reste exige une session valide. Page → redirection vers /login ;
 * API → 401 JSON (pas de redirection HTML pour un appel fetch).
 */
const PUBLIC_PATHS = new Set(["/", "/login", "/api/auth/login", "/api/auth/logout"]);

export function proxy(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  // Fichiers de public/ (images d'agents, svg…) : publics. Jamais sous /api —
  // des routes comme /api/reports/file/x.pdf servent des livrables privés.
  if (!pathname.startsWith("/api/") && /\.[a-zA-Z0-9]+$/.test(pathname)) return NextResponse.next();
  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Authentification requise" }, { status: 401 });
  }
  const login = new URL("/login", request.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
