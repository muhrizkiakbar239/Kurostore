import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL
      && process.env.SUPABASE_ANON_KEY
      && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
}

export function createAuthClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase authentication configuration is incomplete.');
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function createAdminClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase server configuration is incomplete.');
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
