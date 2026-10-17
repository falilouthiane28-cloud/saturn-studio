import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function createAdmin(): SupabaseClient<Database> {
  if (!supabaseUrl || !serviceRoleKey) {
    const result = { data: null, error: new Error("Supabase not configured") };
    const chainable: unknown = new Proxy(() => {}, {
      get: () => chainable,
      apply: () => chainable,
      ...(Symbol.iterator ? { [Symbol.iterator]: () => ({ next: () => ({ done: true }) }) } : {}),
    });
    Object.assign(chainable as object, { then: (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve) });
    return chainable as SupabaseClient<Database>;
  }
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

export const supabaseAdmin = createAdmin();
