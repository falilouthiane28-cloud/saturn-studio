import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { cookies } from "next/headers";

/**
 * Google OAuth 2.0 — natif, pas de SDK tiers.
 *
 * Flow :
 *   1. User → /api/integrations/google/start → redirect vers Google consent
 *   2. Google → /api/integrations/google/callback?code=xxx → exchange code → tokens
 *   3. Tokens persistés dans un cookie chiffré AES-256-GCM (compatible Vercel)
 *   4. getValidAccessToken() rafraîchit automatiquement si expiré
 */

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // epoch ms
  scope: string;
  token_type: string;
  id_token?: string;
}

const COOKIE_NAME = "google_tokens";

// Scopes nécessaires pour YouTube + Gmail + Drive (union — un seul consent)
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function isGoogleConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_REDIRECT_URI
  );
}

// --- Chiffrement AES-256-GCM pour le cookie ---

function encryptionKey(): Buffer {
  return createHash("sha256")
    .update(`saturn-google:v1:${process.env.SATURN_ACCESS_PASSWORD ?? "dev"}`)
    .digest();
}

function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${encrypted.toString("hex")}.${tag.toString("hex")}`;
}

function decrypt(ciphertext: string): string {
  const [ivHex, encHex, tagHex] = ciphertext.split(".");
  if (!ivHex || !encHex || !tagHex) throw new Error("Invalid token cookie");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivHex, "hex")
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return (
    decipher.update(Buffer.from(encHex, "hex"), undefined, "utf8") +
    decipher.final("utf8")
  );
}

// --- Persistance des tokens via cookie chiffré ---

export async function saveTokens(tokens: GoogleTokens): Promise<void> {
  const { id_token: _, ...toStore } = tokens;
  const encrypted = encrypt(JSON.stringify(toStore));
  const jar = await cookies();
  jar.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
}

export async function loadTokens(): Promise<GoogleTokens | null> {
  try {
    const jar = await cookies();
    const cookie = jar.get(COOKIE_NAME)?.value;
    if (!cookie) return null;
    return JSON.parse(decrypt(cookie)) as GoogleTokens;
  } catch {
    return null;
  }
}

// --- OAuth ---

export function buildAuthUrl(state?: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", process.env.GOOGLE_REDIRECT_URI!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  if (state) url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeCodeForTokens(
  code: string
): Promise<GoogleTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google token exchange ${res.status} : ${body}`);
  }

  const data = await res.json();
  const now = Date.now();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: now + (data.expires_in ?? 3600) * 1000 - 60_000,
    scope: data.scope,
    token_type: data.token_type,
    id_token: data.id_token,
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<Partial<GoogleTokens>> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google refresh ${res.status} : ${body}`);
  }

  const data = await res.json();
  return {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 - 60_000,
    scope: data.scope,
    token_type: data.token_type,
  };
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = await loadTokens();
  if (!tokens) {
    throw new Error(
      "Aucun token Google enregistré. Connectez-vous via /api/integrations/google/start."
    );
  }

  if (tokens.expires_at > Date.now()) {
    return tokens.access_token;
  }

  if (!tokens.refresh_token) {
    throw new Error(
      "Token Google expiré et pas de refresh_token. Reconnectez-vous."
    );
  }

  const refreshed = await refreshAccessToken(tokens.refresh_token);
  const merged: GoogleTokens = {
    ...tokens,
    access_token: refreshed.access_token!,
    expires_at: refreshed.expires_at!,
    scope: refreshed.scope ?? tokens.scope,
  };
  try {
    await saveTokens(merged);
  } catch {
    // cookies().set() only works in Route Handlers — silent fail in other contexts
  }
  return merged.access_token;
}

export async function getGoogleStatus(): Promise<{
  connected: boolean;
  email?: string;
  scopes?: string[];
}> {
  const tokens = await loadTokens();
  if (!tokens) return { connected: false };
  let email: string | undefined;
  try {
    const token = await getValidAccessToken();
    const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      email = data.email;
    }
  } catch {
    // ignore
  }
  return {
    connected: true,
    email,
    scopes: tokens.scope?.split(" "),
  };
}
