/**
 * Store de l'agente e-commerce (Emma) — historique des vidéos générées
 * et catalogue local des produits.
 * Persisté dans Supabase (table live_data, clé "ecommerce_store").
 */

import { readLiveData, writeLiveData } from "@/lib/supabase/liveStore";

const SOURCE = "ecommerce_store";

export interface EcomProduct {
  arcadsId: string;
  name: string;
  description?: string;
  photoUrl?: string;
  arcadsImagePath?: string;
  createdAt: string;
}

export interface EcomVideo {
  id: string;
  kind: "avatar" | "showcase";
  backend?: "mcp" | "api";
  arcadsId: string;
  title: string;
  productArcadsId: string;
  productName: string;
  script?: string;
  prompt?: string;
  actorName?: string;
  actorImageUrl?: string;
  aspectRatio?: string;
  status: "processing" | "completed" | "failed";
  url?: string;
  thumbnailUrl?: string;
  error?: string;
  createdAt: string;
  scheduled?: { day: string; time: string; channel: "Instagram"; caption?: string };
}

interface EcomStore {
  products: EcomProduct[];
  videos: EcomVideo[];
}

export async function readStore(): Promise<EcomStore> {
  const result = await readLiveData<EcomStore>(SOURCE);
  if (result?.data) {
    return { products: result.data.products ?? [], videos: result.data.videos ?? [] };
  }
  return { products: [], videos: [] };
}

export async function writeStore(store: EcomStore): Promise<void> {
  await writeLiveData(SOURCE, store);
}

let writeLock: Promise<unknown> = Promise.resolve();
function mutate<T>(fn: (store: EcomStore) => T | Promise<T>): Promise<T> {
  const run = writeLock.then(async () => {
    const store = await readStore();
    const result = await fn(store);
    await writeStore(store);
    return result;
  });
  writeLock = run.catch(() => undefined);
  return run;
}

export async function upsertProduct(p: EcomProduct): Promise<void> {
  await mutate((store) => {
    const i = store.products.findIndex((x) => x.arcadsId === p.arcadsId);
    if (i >= 0) store.products[i] = { ...store.products[i], ...p };
    else store.products.unshift(p);
  });
}

export async function replaceProductId(oldId: string, newId: string): Promise<void> {
  await mutate((store) => {
    const p = store.products.find((x) => x.arcadsId === oldId);
    if (p) p.arcadsId = newId;
    for (const v of store.videos) {
      if (v.productArcadsId === oldId) v.productArcadsId = newId;
    }
  });
}

export async function deleteVideo(id: string): Promise<boolean> {
  return mutate((store) => {
    const before = store.videos.length;
    store.videos = store.videos.filter((v) => v.id !== id);
    return store.videos.length < before;
  });
}

export async function deleteProduct(arcadsId: string): Promise<void> {
  await mutate((store) => {
    store.products = store.products.filter((p) => p.arcadsId !== arcadsId);
  });
}

export async function addVideo(v: EcomVideo): Promise<void> {
  await mutate((store) => {
    store.videos.unshift(v);
  });
}

export async function updateVideo(id: string, patch: Partial<EcomVideo>): Promise<EcomVideo | null> {
  return mutate((store) => {
    const i = store.videos.findIndex((x) => x.id === id);
    if (i < 0) return null;
    store.videos[i] = { ...store.videos[i], ...patch };
    return store.videos[i];
  });
}

export async function savePhoto(_buffer: Buffer, _ext: string): Promise<string> {
  // Photos are not supported in Supabase-only mode (requires Supabase Storage)
  // For now, return a placeholder — photos should be stored in Supabase Storage later
  return `/api/ecommerce/photo/placeholder.png`;
}

export async function readPhoto(_name: string): Promise<Buffer | null> {
  return null;
}
