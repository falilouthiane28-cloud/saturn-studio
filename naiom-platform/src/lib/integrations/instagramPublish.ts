import { promises as fs } from "node:fs";
import path from "node:path";

/**
 * Instagram — connexion « Instagram API with Instagram Login » + publication.
 * Pas de Page Facebook requise : un compte Instagram professionnel suffit.
 * Variables : INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, INSTAGRAM_REDIRECT_URI,
 * PUBLIC_SITE_URL (pour publier un média hébergé par la plateforme).
 *
 * Le jeton long dure 60 jours et se prolonge (refresh) s'il a plus de 24 h.
 */
const TOKENS_FILE = path.join(process.cwd(), "src", "data", "instagram-tokens.json");
const GRAPH = `https://graph.instagram.com/${process.env.INSTAGRAM_GRAPH_VERSION ?? "v23.0"}`;
const SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];
const DAY = 86_400_000;

export interface InstagramTokens {
  access_token: string;
  expires_at: number;
  issued_at: number;
  user_id: string;
  username?: string;
}

export function isInstagramConfigured(): boolean {
  return Boolean(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET && process.env.INSTAGRAM_REDIRECT_URI);
}

export function buildInstagramAuthUrl(state: string): string {
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("client_id", process.env.INSTAGRAM_APP_ID!);
  u.searchParams.set("redirect_uri", process.env.INSTAGRAM_REDIRECT_URI!);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPES.join(","));
  u.searchParams.set("state", state);
  return u.toString();
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, cache: "no-store" });
  const data = (await res.json()) as T & { error?: { message?: string }; error_message?: string };
  if (!res.ok || data.error) {
    throw new Error(`Instagram : ${data.error?.message ?? data.error_message ?? res.status}`);
  }
  return data;
}

export async function exchangeInstagramCode(rawCode: string): Promise<InstagramTokens> {
  const code = rawCode.replace(/#_$/, ""); // Instagram ajoute parfois « #_ » au code
  const short = await getJson<{ access_token: string; user_id: number | string }>(
    "https://api.instagram.com/oauth/access_token",
    {
      method: "POST",
      body: new URLSearchParams({
        client_id: process.env.INSTAGRAM_APP_ID!,
        client_secret: process.env.INSTAGRAM_APP_SECRET!,
        grant_type: "authorization_code",
        redirect_uri: process.env.INSTAGRAM_REDIRECT_URI!,
        code,
      }),
    }
  );
  const long = await getJson<{ access_token: string; expires_in: number }>(
    `https://graph.instagram.com/access_token?${new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: process.env.INSTAGRAM_APP_SECRET!,
      access_token: short.access_token,
    })}`
  );
  const me = await getJson<{ user_id?: string; username?: string }>(
    `${GRAPH}/me?fields=user_id,username&access_token=${encodeURIComponent(long.access_token)}`
  );
  const now = Date.now();
  return {
    access_token: long.access_token,
    expires_at: now + long.expires_in * 1000,
    issued_at: now,
    user_id: String(me.user_id ?? short.user_id),
    username: me.username,
  };
}

export async function saveInstagramTokens(t: InstagramTokens): Promise<void> {
  await fs.mkdir(path.dirname(TOKENS_FILE), { recursive: true });
  await fs.writeFile(TOKENS_FILE, JSON.stringify(t, null, 2), { encoding: "utf-8", mode: 0o600 });
}

export async function loadInstagramTokens(): Promise<InstagramTokens | null> {
  try {
    return JSON.parse(await fs.readFile(TOKENS_FILE, "utf-8")) as InstagramTokens;
  } catch {
    return null;
  }
}

export async function getInstagramStatus(): Promise<{ connected: boolean; username?: string; expired?: boolean }> {
  const t = await loadInstagramTokens();
  if (!t) return { connected: false };
  const expired = t.expires_at < Date.now();
  return { connected: !expired, username: t.username, expired };
}

/** Jeton valide ; prolongé automatiquement s'il expire dans < 10 jours (et a plus de 24 h). */
async function validTokens(): Promise<InstagramTokens> {
  const t = await loadInstagramTokens();
  if (!t) throw new Error("Instagram n'est pas connecté : Connexions → « Connecter Instagram ».");
  if (t.expires_at < Date.now()) throw new Error("La connexion Instagram a expiré : reconnectez Instagram dans Connexions.");
  if (t.expires_at - Date.now() < 10 * DAY && Date.now() - t.issued_at > DAY) {
    try {
      const r = await getJson<{ access_token: string; expires_in: number }>(
        `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(t.access_token)}`
      );
      const fresh = { ...t, access_token: r.access_token, expires_at: Date.now() + r.expires_in * 1000, issued_at: Date.now() };
      await saveInstagramTokens(fresh);
      return fresh;
    } catch {
      return t; // l'ancien jeton reste valable jusqu'à son expiration
    }
  }
  return t;
}

/** Instagram télécharge le média lui-même : il faut une URL https publique. */
export function publicMediaUrl(input: string): string {
  const v = input.trim();
  if (v.startsWith("/")) {
    const base = process.env.PUBLIC_SITE_URL?.replace(/\/$/, "");
    if (!base) throw new Error("Média local : PUBLIC_SITE_URL n'est pas configurée sur le serveur.");
    return base + v;
  }
  if (!/^https:\/\/[^\s]+$/.test(v)) throw new Error("Le média doit être une URL https publique (ou un chemin /… de la plateforme).");
  return v;
}

/** Publie une image ou un Reel. Renvoie le lien du post. */
export async function publishInstagram(params: {
  mediaUrl: string;
  mediaType: "IMAGE" | "REELS";
  caption: string;
}): Promise<{ id: string; permalink?: string }> {
  const t = await validTokens();
  const caption = params.caption.trim();
  if (caption.length > 2200) throw new Error(`Légende trop longue (${caption.length}/2200 caractères).`);
  const url = publicMediaUrl(params.mediaUrl);
  const auth = `access_token=${encodeURIComponent(t.access_token)}`;

  // 1. Conteneur de média
  const body = new URLSearchParams({ caption });
  if (params.mediaType === "REELS") {
    body.set("media_type", "REELS");
    body.set("video_url", url);
  } else {
    body.set("image_url", url);
  }
  const container = await getJson<{ id: string }>(`${GRAPH}/${t.user_id}/media?${auth}`, { method: "POST", body });

  // 2. Attente du traitement (vidéo surtout) : jusqu'à ~2 min
  for (let i = 0; i < 24; i++) {
    const s = await getJson<{ status_code?: string }>(`${GRAPH}/${container.id}?fields=status_code&${auth}`);
    if (s.status_code === "FINISHED" || !s.status_code) break;
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED") {
      throw new Error("Instagram n'a pas pu traiter le média (format, taille ou URL inaccessible).");
    }
    await new Promise((r) => setTimeout(r, 5000));
  }

  // 3. Publication
  const pub = await getJson<{ id: string }>(`${GRAPH}/${t.user_id}/media_publish?${auth}`, {
    method: "POST",
    body: new URLSearchParams({ creation_id: container.id }),
  });
  const info = await getJson<{ permalink?: string }>(`${GRAPH}/${pub.id}?fields=permalink&${auth}`).catch(() => ({ permalink: undefined }));
  return { id: pub.id, permalink: info.permalink };
}
