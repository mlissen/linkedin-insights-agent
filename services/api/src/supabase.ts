import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false },
      global: { headers: { 'X-Client-Info': 'linkedin-insights-api' } },
    });
  }
  return client;
}
