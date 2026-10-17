import { supabaseAdmin } from "./server";

/**
 * Stockage clé-valeur pour les données live (YouTube, Gmail, Drive, etc.)
 * via la table Supabase `live_data`. Remplace les fichiers live-*.json
 * incompatibles avec Vercel (EROFS: read-only file system).
 */

export async function writeLiveData(source: string, payload: unknown): Promise<void> {
  const { error } = await supabaseAdmin
    .from("live_data")
    .upsert(
      { source, payload: JSON.parse(JSON.stringify(payload)), updated_at: new Date().toISOString() },
      { onConflict: "source" }
    );
  if (error) throw new Error(`Supabase writeLiveData(${source}): ${error.message}`);
}

export async function readLiveData<T = unknown>(source: string): Promise<{ data: T; updatedAt: string } | null> {
  const { data, error } = await supabaseAdmin
    .from("live_data")
    .select("payload, updated_at")
    .eq("source", source)
    .single();
  if (error || !data) return null;
  return {
    data: data.payload as T,
    updatedAt: data.updated_at,
  };
}

export async function deleteLiveData(source: string): Promise<void> {
  await supabaseAdmin.from("live_data").delete().eq("source", source);
}
