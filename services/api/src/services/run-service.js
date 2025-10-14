import { z } from 'zod';
import { getSupabase } from '../supabase.js';
import { config } from '../config.js';
import { runQueue } from '../queue.js';
import { logger } from '../logger.js';
const schema = z.object({
    profileUrls: z.array(z.string().url()).nonempty(),
    topics: z.array(z.string().min(1)).max(24),
    outputFormat: z.enum(['ai-ready', 'briefing']),
    nickname: z.string().max(80).optional(),
    postLimit: z.number().int().min(10).max(200).optional(),
});
function canonicalizeProfile(url) {
    return url
        .trim()
        .replace(/(\?.*)$/, '')
        .replace(/\/$/, '');
}
function currentPeriodStart() {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01`;
}
export async function ensureUserRecord(auth) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('users')
        .upsert({
        auth_user_id: auth.userId,
        email: auth.email,
    }, { onConflict: 'auth_user_id' })
        .select('id')
        .single();
    if (error) {
        logger.error({ error }, 'Failed to upsert user');
        throw error;
    }
    return data.id;
}
export async function validateRunConfig(input) {
    const parsed = schema.parse(input);
    const uniqueProfiles = [...new Set(parsed.profileUrls.map(canonicalizeProfile))];
    if (uniqueProfiles.length > 10) {
        throw new Error('You can analyze up to 10 experts per run');
    }
    return {
        ...parsed,
        profileUrls: uniqueProfiles,
        topics: parsed.topics.map((topic) => topic.trim()).filter(Boolean),
        postLimit: parsed.postLimit ?? 200,
    };
}
export async function checkRunLimit(userId) {
    const supabase = getSupabase();
    const periodStart = currentPeriodStart();
    const { data, error } = await supabase
        .from('usage_counters')
        .select('runs_used')
        .eq('user_id', userId)
        .eq('period_start', periodStart)
        .single();
    if (error && error.code !== 'PGRST116') {
        throw error;
    }
    const runsUsed = data?.runs_used ?? 0;
    if (runsUsed >= config.runLimit) {
        throw Object.assign(new Error('Run limit reached'), { remaining: 0 });
    }
    return config.runLimit - runsUsed;
}
export async function incrementRunUsage(userId) {
    const supabase = getSupabase();
    const periodStart = currentPeriodStart();
    const { error } = await supabase.rpc('increment_run_usage', {
        p_user_id: userId,
        p_period_start: periodStart,
    });
    if (error) {
        throw error;
    }
}
export async function createRun(userId, configInput) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('runs')
        .insert({
        user_id: userId,
        config: configInput,
        run_nickname: configInput.nickname ?? null,
    })
        .select('id, status, created_at')
        .single();
    if (error) {
        throw error;
    }
    await runQueue.add('run', { runId: data.id, userId });
    return data;
}
export async function listRuns(userId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('runs')
        .select('id, status, run_nickname, created_at, completed_at, failure_reason, token_estimate, cost_estimate')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
    if (error) {
        throw error;
    }
    return data;
}
export async function getRun(userId, runId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('runs')
        .select('id, status, config, run_nickname, created_at, completed_at, failure_reason, token_estimate, cost_estimate, needs_login_url')
        .eq('user_id', userId)
        .eq('id', runId)
        .single();
    if (error) {
        throw error;
    }
    return data;
}
