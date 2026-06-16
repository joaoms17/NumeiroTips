/**
 * Cliente Supabase (opcional).
 * O MVP corre sem Supabase (motor mock local). Quando VITE_SUPABASE_* estão
 * definidos, este cliente liga-se para Realtime/Auth/persistência.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (client) return client;
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return client;
}
