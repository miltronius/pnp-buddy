import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
   Supabase client as a singleton.
   If the environment variables are not set, the client stays
   null — the app then continues in local mode so you can work
   immediately without project credentials.
   ============================================================ */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** true once URL and Publishable Key are present. */
export const isCloudConfigured = Boolean(url && key);

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url as string, key as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Get the client or throw a clear error. */
export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured — add VITE_SUPABASE_URL and " +
      "VITE_SUPABASE_PUBLISHABLE_KEY to .env.local.",
    );
  }
  return supabase;
}

/** Name of the Storage bucket for portraits, flags and map images. */
export const IMAGE_BUCKET = "images";
