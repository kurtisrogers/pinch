import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { isBillingEnabled, supabaseAnonKey, supabaseUrl } from "./config.js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isBillingEnabled()) return null;
  if (!client) {
    client = createClient(supabaseUrl(), supabaseAnonKey());
  }
  return client;
}

export async function getSession(): Promise<Session | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function signInWithEmail(email: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Billing is not configured");

  const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo },
  });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export function onAuthStateChange(callback: (session: Session | null) => void): (() => void) | null {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session);
  });
  return () => data.subscription.unsubscribe();
}

export async function accessToken(): Promise<string | null> {
  const session = await getSession();
  return session?.access_token ?? null;
}

export function currentUserEmail(session: Session | null): string | null {
  return session?.user.email ?? null;
}
