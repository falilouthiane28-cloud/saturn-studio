/**
 * Store de l'agent veille (Nina) — les Reels Instagram récupérés.
 * Persisté dans Supabase (table live_data, clé "veille_posts").
 */

import { readLiveData, writeLiveData } from "@/lib/supabase/liveStore";

const SOURCE = "veille_posts";

export interface VeillePost {
  id: string;
  shortCode: string;
  url: string;
  hashtag: string;
  caption: string;
  hashtags: string[];
  views: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
  market: string;
  authorFollowers?: number;
  query: string;
  durationSec?: number;
  thumbnailUrl?: string;
  videoUrl?: string;
  author: string;
  authorName?: string;
  music?: string;
  postedAt?: string;
  script?: string;
  scriptStatus: "absent" | "en-cours" | "ok" | "erreur";
  scriptError?: string;
  scriptFr?: string;
  shortStatus?: "absent" | "en-cours" | "ok" | "erreur";
  shortUrl?: string;
  shortError?: string;
  scrapedAt: string;
}

export async function readPosts(): Promise<VeillePost[]> {
  const result = await readLiveData<{ posts: VeillePost[] }>(SOURCE);
  return result?.data?.posts ?? [];
}

async function writePosts(posts: VeillePost[]): Promise<void> {
  await writeLiveData(SOURCE, { posts });
}

let writeLock: Promise<unknown> = Promise.resolve();
function mutate<T>(
  fn: (posts: VeillePost[]) => { posts: VeillePost[]; result: T }
): Promise<T> {
  const run = writeLock.then(async () => {
    const current = await readPosts();
    const { posts, result } = fn(current);
    await writePosts(posts);
    return result;
  });
  writeLock = run.catch(() => undefined);
  return run;
}

export async function upsertPosts(fresh: VeillePost[]): Promise<number> {
  return mutate((posts) => {
    const byCode = new Map(posts.map((p) => [p.shortCode, p]));
    let added = 0;
    for (const f of fresh) {
      const known = byCode.get(f.shortCode);
      if (known) {
        Object.assign(known, {
          views: f.views,
          likes: f.likes,
          comments: f.comments,
          shares: f.shares,
          engagementRate: f.engagementRate,
          thumbnailUrl: f.thumbnailUrl,
          videoUrl: f.videoUrl,
          scrapedAt: f.scrapedAt,
        });
      } else {
        posts.unshift(f);
        added++;
      }
    }
    posts.sort((a, b) => b.views - a.views);
    return { posts, result: added };
  });
}

export async function updatePost(
  id: string,
  patch: Partial<VeillePost>
): Promise<VeillePost | null> {
  return mutate((posts) => {
    const i = posts.findIndex((p) => p.id === id);
    if (i < 0) return { posts, result: null };
    posts[i] = { ...posts[i], ...patch };
    return { posts, result: posts[i] };
  });
}

export async function deletePost(id: string): Promise<boolean> {
  return mutate((posts) => {
    const next = posts.filter((p) => p.id !== id);
    return { posts: next, result: next.length < posts.length };
  });
}

export async function clearHashtag(hashtag: string): Promise<number> {
  return mutate((posts) => {
    const next = posts.filter((p) => p.hashtag !== hashtag);
    return { posts: next, result: posts.length - next.length };
  });
}
