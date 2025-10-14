import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';
let client = null;
export function getSupabase() {
    if (!client) {
        client = createClient(config.supabaseUrl, config.supabaseServiceKey, {
            auth: { persistSession: false },
            global: { headers: { 'X-Client-Info': 'linkedin-insights-worker' } },
        });
    }
    return client;
}
