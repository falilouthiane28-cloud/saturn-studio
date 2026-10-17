/**
 * Store du Creative Strategist : brand kit + créatives générées.
 * Persisté dans Supabase (table live_data, clé "creative_store").
 */
import { readLiveData, writeLiveData } from "@/lib/supabase/liveStore";

const SOURCE = "creative_store";

export interface BrandKit {
  name: string;
  logoDataUrl: string | null;
  palette: string[];
  font: string;
  univers: string;
  notes: string;
  updatedAt: string;
}

export interface Creative {
  id: string;
  idea: string;
  format: string;
  prompt: string;
  negativePrompt?: string;
  status: "pending" | "done" | "error";
  imageUrl: string | null;
  thumbUrl: string | null;
  requestId?: string;
  statusUrl?: string | null;
  error?: string;
  createdAt: string;
  schedule?: { platform: string; at: string; status: "scheduled" | "posted" } | null;
}

export interface CreativeStore {
  brandKit: BrandKit;
  creatives: Creative[];
}

const DEFAULT_KIT: BrandKit = {
  name: "Saturn Studio",
  logoDataUrl: null,
  palette: ["#6D28D9", "#5B4DEE", "#111111", "#FFFFFF"],
  font: "Archivo",
  univers: "",
  notes: "",
  updatedAt: new Date().toISOString(),
};

export async function readStore(): Promise<CreativeStore> {
  const result = await readLiveData<Partial<CreativeStore>>(SOURCE);
  if (result?.data) {
    return { brandKit: { ...DEFAULT_KIT, ...(result.data.brandKit ?? {}) }, creatives: result.data.creatives ?? [] };
  }
  return { brandKit: DEFAULT_KIT, creatives: [] };
}

export async function writeStore(s: CreativeStore): Promise<void> {
  await writeLiveData(SOURCE, s);
}

export async function saveBrandKit(patch: Partial<BrandKit>): Promise<BrandKit> {
  const s = await readStore();
  s.brandKit = { ...s.brandKit, ...patch, updatedAt: new Date().toISOString() };
  await writeStore(s);
  return s.brandKit;
}

export async function addCreative(c: Creative): Promise<void> {
  const s = await readStore();
  s.creatives.unshift(c);
  await writeStore(s);
}

export async function updateCreative(id: string, patch: Partial<Creative>): Promise<Creative | null> {
  const s = await readStore();
  const i = s.creatives.findIndex((x) => x.id === id);
  if (i < 0) return null;
  s.creatives[i] = { ...s.creatives[i], ...patch };
  await writeStore(s);
  return s.creatives[i];
}
