import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { istCloudKonfiguriert, supabase } from "../lib/supabase";

export interface AuthZustand {
  session: Session | null;
  user: User | null;
  laedt: boolean;
  /** false, wenn kein Supabase-Projekt hinterlegt ist — dann läuft alles lokal. */
  cloud: boolean;
}

/** Stellt die aktuelle Supabase-Sitzung bereit und hält sie aktuell. */
export function useAuth(): AuthZustand {
  const [session, setSession] = useState<Session | null>(null);
  const [laedt, setLaedt] = useState(istCloudKonfiguriert);

  useEffect(() => {
    if (!supabase) return;              // lokaler Modus: nichts zu laden
    let aktiv = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!aktiv) return;
      setSession(data.session);
      setLaedt(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_ereignis, s) => {
      setSession(s);
      setLaedt(false);
    });

    return () => {
      aktiv = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    laedt,
    cloud: istCloudKonfiguriert,
  };
}

export async function anmelden(email: string, passwort: string): Promise<void> {
  if (!supabase) throw new Error("Supabase ist nicht konfiguriert");
  const { error } = await supabase.auth.signInWithPassword({ email, password: passwort });
  if (error) throw error;
}

export async function registrieren(email: string, passwort: string): Promise<{ bestaetigungNoetig: boolean }> {
  if (!supabase) throw new Error("Supabase ist nicht konfiguriert");
  const { data, error } = await supabase.auth.signUp({ email, password: passwort });
  if (error) throw error;
  // Ohne Session heißt: Supabase erwartet die Bestätigung per E-Mail.
  return { bestaetigungNoetig: !data.session };
}

export async function abmelden(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
