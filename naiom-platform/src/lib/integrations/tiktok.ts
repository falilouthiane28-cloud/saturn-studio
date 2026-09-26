/**
 * TikTok — tendances via Apify (acteur clockworks~tiktok-scraper).
 * L'API officielle TikTok exige un jeton utilisateur OAuth que la plateforme
 * n'a pas encore ; le scraping Apify couvre la veille (lecture seule).
 */
const APIFY = "https://api.apify.com/v2";
const ACTOR = "clockworks~tiktok-scraper";

export interface TikTokVideo {
  url: string;
  text: string;
  author: string;
  authorFollowers?: number;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  postedAt?: string;
  music?: string;
  hashtags: string[];
}

interface RawTikTok {
  webVideoUrl?: string;
  text?: string;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  createTimeISO?: string;
  authorMeta?: { name?: string; fans?: number };
  musicMeta?: { musicName?: string; musicAuthor?: string };
  hashtags?: { name?: string }[];
}

export async function tiktokTrends(params: {
  hashtags?: string[];
  searchQueries?: string[];
  resultsPerQuery?: number;
}): Promise<TikTokVideo[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("APIFY_TOKEN absent : la veille TikTok passe par Apify.");
  const hashtags = (params.hashtags ?? []).map((h) => h.replace(/^#/, "").trim()).filter(Boolean);
  const searchQueries = (params.searchQueries ?? []).map((q) => q.trim()).filter(Boolean);
  if (!hashtags.length && !searchQueries.length) throw new Error("Donnez au moins un hashtag ou une recherche.");

  const res = await fetch(`${APIFY}/acts/${ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=240`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      hashtags,
      searchQueries,
      resultsPerPage: Math.min(Math.max(params.resultsPerQuery ?? 10, 1), 20),
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Apify TikTok → ${res.status} : ${text.slice(0, 300)}`);
  const raw = JSON.parse(text) as RawTikTok[];

  return raw
    .filter((r) => r.webVideoUrl)
    .map((r) => {
      const views = r.playCount ?? 0;
      const likes = r.diggCount ?? 0;
      const comments = r.commentCount ?? 0;
      const shares = r.shareCount ?? 0;
      return {
        url: r.webVideoUrl!,
        text: (r.text ?? "").slice(0, 280),
        author: r.authorMeta?.name ?? "",
        authorFollowers: r.authorMeta?.fans,
        views,
        likes,
        comments,
        shares,
        engagementRate: views ? Number((((likes + comments + shares) / views) * 100).toFixed(2)) : 0,
        postedAt: r.createTimeISO,
        music: r.musicMeta?.musicName ? `${r.musicMeta.musicName} — ${r.musicMeta.musicAuthor ?? ""}`.trim() : undefined,
        hashtags: (r.hashtags ?? []).map((h) => h.name ?? "").filter(Boolean),
      };
    })
    .sort((a, b) => b.views - a.views);
}
