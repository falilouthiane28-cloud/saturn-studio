import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createAdmin(): SupabaseClient<Database> {
  if (!supabaseUrl || !serviceRoleKey) {
    const handler = { get: () => () => ({ data: null, error: new Error("Supabase not configured") }) };
    return new Proxy({} as SupabaseClient<Database>, handler);
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export const supabaseAdmin = createAdmin();
