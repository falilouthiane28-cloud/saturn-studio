import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Accès au Studio : un mot de passe unique (SATURN_ACCESS_PASSWORD), une
 * session en cookie signé HMAC. Sans mot de passe configuré (dev local),
 * l'accès est ouvert.
 *
 * La clé de signature dérive du mot de passe : le changer invalide toutes
 * les sessions ouvertes.
 */
export const SESSION_COOKIE = "saturn_session";
export const SESSION_DAYS = 30;

function password(): string {
  return process.env.SATURN_ACCESS_PASSWORD ?? "";
}

export function authEnabled(): boolean {
  return password().length > 0;
}

function key(): Buffer {
  return createHash("sha256").update(`saturn-session:v1:${password()}`).digest();
}

function sign(payload: string): string {
  return createHmac("sha256", key()).update(payload).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(candidate: string): boolean {
  return authEnabled() && safeEqual(candidate, password());
}

/** Jeton `<expiration en ms>.<signature>`. */
export function createSessionToken(): string {
  const exp = String(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  return `${exp}.${sign(exp)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(exp));
}

/** N'accepte qu'un chemin interne (bloque les redirections ouvertes `//site`). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/dashboard";
  return next;
}
