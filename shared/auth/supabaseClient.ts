import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL ?? "";
}

export function getSupabaseAnonKey(): string {
  return (
    import.meta.env.VITE_SUPABASE_ANON_KEY ??
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    ""
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    const url = getSupabaseUrl();
    const key = getSupabaseAnonKey();
    if (!url || !key) {
      throw new Error("Supabase is not configured.");
    }
    client = createClient(url, key, {
      auth: {
        detectSessionInUrl: true,
        persistSession: true,
        flowType: "pkce",
        autoRefreshToken: true,
      },
    });
  }
  return client;
}

export function getAccessToken(session: Session | null): string | null {
  return session?.access_token ?? null;
}
