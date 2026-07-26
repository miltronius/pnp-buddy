import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/* ============================================================
   Supabase-Client als Singleton.
   Sind die Umgebungsvariablen nicht gesetzt, bleibt der Client
   null — die App läuft dann im lokalen Modus weiter, damit man
   ohne Projekt-Zugangsdaten sofort arbeiten kann.
   ============================================================ */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** true, sobald URL und Publishable Key vorhanden sind. */
export const istCloudKonfiguriert = Boolean(url && key);

export const supabase: SupabaseClient | null = istCloudKonfiguriert
  ? createClient(url as string, key as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/** Client holen oder verständlich scheitern. */
export function benoetigeSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase ist nicht konfiguriert — VITE_SUPABASE_URL und " +
      "VITE_SUPABASE_PUBLISHABLE_KEY in .env.local eintragen.",
    );
  }
  return supabase;
}

/** Name des Storage-Buckets für Porträts, Flaggen und Kartenbilder. */
export const BILD_BUCKET = "bilder";
