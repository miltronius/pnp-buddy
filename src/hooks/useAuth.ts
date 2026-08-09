import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isCloudConfigured, supabase } from "../lib/supabase";

export interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
  /** false, wenn kein Supabase-Projekt hinterlegt ist — dann läuft alles lokal. */
  cloud: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isCloudConfigured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    loading,
    cloud: isCloudConfigured,
  };
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error("Supabase ist nicht konfiguriert");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string): Promise<{ confirmationRequired: boolean }> {
  if (!supabase) throw new Error("Supabase ist nicht konfiguriert");
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return { confirmationRequired: !data.session };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}
