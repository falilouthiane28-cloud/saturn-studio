import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function createBrowserClient(): SupabaseClient<Database> {
  if (!supabaseUrl || !supabaseKey) {
    const handler = { get: () => () => ({ data: null, error: new Error("Supabase not configured") }) };
    return new Proxy({} as SupabaseClient<Database>, handler);
  }
  return createClient<Database>(supabaseUrl, supabaseKey);
}

export const supabase = createBrowserClient();
