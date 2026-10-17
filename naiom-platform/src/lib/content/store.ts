/**
 * Store des posts créés par Fatou (agent contenu).
 * Persisté dans Supabase (table live_data, clé "content_posts").
 */
import { readLiveData, writeLiveData } from "@/lib/supabase/liveStore";
import type { ContentResult, Platform, Format } from "./generate";
import type { NinaBrief } from "./nina";

const SOURCE = "content_posts";

export interface SlideJob {
  index: number;
  jobId: string;
  tries?: number;
  state?: "waiting" | "pending" | "done" | "failed";
  at?: number;
  qc?: number;
  lastFix?: string;
  error?: "credits";
}
export interface ContentPost {
  id: string;
  platform: Platform;
  format: Format;
  idea: string;
  template?: string;
  refId?: string;
  result: ContentResult;
  scenes?: string[];
  nina?: NinaBrief;
  visuals?: { jobs: SlideJob[]; images: (string | null)[]; done: boolean; scenes?: (string | null)[]; note?: string };
  status: "draft" | "scheduled" | "posted";
  schedule?: { at: string } | null;
  createdAt: string;
}

interface Store { posts: ContentPost[] }

async function read(): Promise<Store> {
  const result = await readLiveData<Store>(SOURCE);
  return result?.data ?? { posts: [] };
}
async function write(s: Store): Promise<void> {
  await writeLiveData(SOURCE, s);
}

export async function listPosts(): Promise<ContentPost[]> {
  const s = await read();
  return s.posts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getPost(id: string): Promise<ContentPost | null> {
  const s = await read();
  return s.posts.find((p) => p.id === id) ?? null;
}

export async function addPost(p: Omit<ContentPost, "id" | "createdAt" | "status">): Promise<ContentPost> {
  const s = await read();
  const post: ContentPost = { ...p, id: `post-${Date.now().toString(36)}`, status: "draft", createdAt: new Date().toISOString() };
  s.posts.unshift(post);
  await write(s);
  return post;
}

export async function updatePost(id: string, patch: Partial<ContentPost>): Promise<ContentPost | null> {
  const s = await read();
  const i = s.posts.findIndex((p) => p.id === id);
  if (i < 0) return null;
  s.posts[i] = { ...s.posts[i], ...patch };
  await write(s);
  return s.posts[i];
}

export async function deletePost(id: string): Promise<void> {
  const s = await read();
  s.posts = s.posts.filter((p) => p.id !== id);
  await write(s);
}
