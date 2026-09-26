import { promises as fs } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

/**
 * LinkedIn — connexion OAuth 2.0 + publication d'un post sur le profil.
 *
 * App requise (linkedin.com/developers) avec les produits « Sign In with
 * LinkedIn using OpenID Connect » et « Share on LinkedIn ».
 * Variables : LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REDIRECT_URI.
 * Le jeton dure 60 jours, sans jeton de rafraîchissement : il faut reconnecter.
 */
const TOKENS_FILE = path.join(process.cwd(), "src", "data", "linkedin-tokens.json");
const SCOPES = ["openid", "profile", "w_member_social"];

export interface LinkedInTokens {
  access_token: string;
  expires_at: number;
  person_urn: string;
  name?: string;
}

export function isLinkedInConfigured(): boolean {
  return Boolean(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET && process.env.LINKEDIN_REDIRECT_URI);
}

export function newOAuthState(): string {
  return randomBytes(16).toString("hex");
}

export function buildLinkedInAuthUrl(state: string): string {
  const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env.LINKEDIN_CLIENT_ID!);
  u.searchParams.set("redirect_uri", process.env.LINKEDIN_REDIRECT_URI!);
  u.searchParams.set("state", state);
  u.searchParams.set("scope", SCOPES.join(" "));
  return u.toString();
}

export async function exchangeLinkedInCode(code: string): Promise<LinkedInTokens> {
  const res = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.LINKEDIN_REDIRECT_URI!,
      client_id: process.env.LINKEDIN_CLIENT_ID!,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
    }),
    cache: "no-store",
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !data.access_token) throw new Error(`LinkedIn : ${data.error_description ?? res.status}`);

  // Identité du membre : son URN est l'auteur des posts.
  const me = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${data.access_token}` },
    cache: "no-store",
  });
  const info = (await me.json()) as { sub?: string; name?: string };
  if (!me.ok || !info.sub) throw new Error("LinkedIn : impossible de lire le profil connecté.");

  return {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in ?? 5_184_000) * 1000,
    person_urn: `urn:li:person:${info.sub}`,
    name: info.name,
  };
}

export async function saveLinkedInTokens(t: LinkedInTokens): Promise<void> {
  await fs.mkdir(path.dirname(TOKENS_FILE), { recursive: true });
  await fs.writeFile(TOKENS_FILE, JSON.stringify(t, null, 2), { encoding: "utf-8", mode: 0o600 });
}

export async function loadLinkedInTokens(): Promise<LinkedInTokens | null> {
  try {
    return JSON.parse(await fs.readFile(TOKENS_FILE, "utf-8")) as LinkedInTokens;
  } catch {
    return null;
  }
}

export async function getLinkedInStatus(): Promise<{ connected: boolean; name?: string; expiresAt?: number; expired?: boolean }> {
  const t = await loadLinkedInTokens();
  if (!t) return { connected: false };
  const expired = t.expires_at < Date.now();
  return { connected: !expired, name: t.name, expiresAt: t.expires_at, expired };
}

/** Version d'API LinkedIn (AAAAMM) : forçable par env, sinon le mois d'il y a 2 mois (versions actives ~1 an). */
function apiVersion(): string {
  if (process.env.LINKEDIN_API_VERSION) return process.env.LINKEDIN_API_VERSION;
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - 2);
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Publie un post texte public sur le profil connecté. Renvoie l'URL du post. */
export async function publishLinkedInPost(text: string): Promise<{ id: string; url: string }> {
  const t = await loadLinkedInTokens();
  if (!t) throw new Error("LinkedIn n'est pas connecté : Connexions → « Connecter LinkedIn ».");
  if (t.expires_at < Date.now()) throw new Error("La connexion LinkedIn a expiré (60 jours) : reconnectez LinkedIn dans Connexions.");
  const commentary = text.trim();
  if (!commentary) throw new Error("Post vide.");
  if (commentary.length > 3000) throw new Error(`Post trop long (${commentary.length}/3000 caractères).`);

  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${t.access_token}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": apiVersion(),
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: t.person_urn,
      commentary,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`LinkedIn a refusé la publication (${res.status}) : ${(await res.text()).slice(0, 300)}`);
  const id = res.headers.get("x-restli-id") ?? "";
  return { id, url: id ? `https://www.linkedin.com/feed/update/${id}/` : "https://www.linkedin.com/in/me/recent-activity/all/" };
}
