import { Queue } from 'bullmq';
import { config } from './config.js';
import { logger } from './logger.js';
import { getSupabase } from './supabase.js';
import { ensureLoginSession, captureCookiesFromSession, encryptCookies, decryptCookies, } from './browser-login.js';
import { storeArtifact } from './storage.js';
import { RemoteScraper } from './remote-scraper.js';
import { buildKnowledgeBundle, } from './knowledge-bundler.js';
async function loadInsightAnalyzerCtor() {
    const modulePath = '../../../src/' + 'analyzer.js';
    const mod = (await import(modulePath));
    return mod.InsightAnalyzer;
}
async function loadFormatterInstance() {
    const modulePath = '../../../src/' + 'three-file-formatter.js';
    const mod = (await import(modulePath));
    return new mod.ThreeFileFormatter();
}
const requeueQueue = new Queue('insight-runs', {
    connection: { url: config.queueRedisUrl },
    defaultJobOptions: { removeOnComplete: true, removeOnFail: 1000 },
});
async function fetchRun(runId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('runs')
        .select('id,user_id,status,config')
        .eq('id', runId)
        .single();
    if (error && error.code !== 'PGRST116')
        throw error;
    return data;
}
async function getActiveSession(userId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('linked_sessions')
        .select('id, encrypted_payload, expires_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    if (error && error.code !== 'PGRST116')
        throw error;
    if (!data)
        return null;
    return {
        id: data.id,
        cookies: decryptCookies(data.encrypted_payload),
        expiresAt: data.expires_at ?? null,
    };
}
async function getLatestLoginEvent(runId) {
    const supabase = getSupabase();
    const { data, error } = await supabase
        .from('run_events')
        .select('payload')
        .eq('run_id', runId)
        .eq('event_type', 'needs_login')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    if (error && error.code !== 'PGRST116')
        throw error;
    return data ? data.payload : null;
}
async function saveSession(userId, cookies, expiresAt) {
    const supabase = getSupabase();
    const { payload } = encryptCookies(cookies);
    await supabase.from('linked_sessions').update({ is_active: false }).eq('user_id', userId);
    const { error } = await supabase.from('linked_sessions').insert({
        user_id: userId,
        provider: 'browserless',
        encrypted_payload: payload,
        encryption_algorithm: 'aes-256-gcm',
        expires_at: expiresAt ?? null,
        is_active: true,
    });
    if (error)
        throw error;
}
async function updateRunStatus(runId, status, payload = {}) {
    const supabase = getSupabase();
    const updates = { status };
    const now = new Date().toISOString();
    if (status === 'running')
        updates.started_at = now;
    if (status === 'completed')
        updates.completed_at = now;
    if (status === 'failed')
        updates.failure_reason = payload.reason ?? 'unknown';
    const { error } = await supabase.from('runs').update(updates).eq('id', runId);
    if (error)
        throw error;
    const { error: eventError } = await supabase.from('run_events').insert({
        run_id: runId,
        event_type: `status_${status}`,
        payload,
    });
    if (eventError)
        throw eventError;
}
async function incrementTokenUsage(userId, tokens) {
    const supabase = getSupabase();
    const periodStart = `${new Date().toISOString().slice(0, 7)}-01`;
    const { data, error } = await supabase
        .from('usage_counters')
        .select('runs_used, tokens_used')
        .eq('user_id', userId)
        .eq('period_start', periodStart)
        .single();
    if (error && error.code !== 'PGRST116')
        throw error;
    const runsUsed = data?.runs_used ?? 0;
    const tokensUsed = data?.tokens_used ?? 0;
    const { error: upsertError } = await supabase.from('usage_counters').upsert({
        user_id: userId,
        period_start: periodStart,
        runs_used: runsUsed,
        tokens_used: tokensUsed + tokens,
    }, { onConflict: 'user_id,period_start' });
    if (upsertError)
        throw upsertError;
}
export async function processRunJob(data, job) {
    const run = await fetchRun(data.runId);
    if (!run) {
        logger.warn({ runId: data.runId }, 'Run not found, dropping job');
        return;
    }
    let session = await getActiveSession(run.user_id);
    if (!session) {
        const pending = await getLatestLoginEvent(run.id);
        if (!pending) {
            await ensureLoginSession(run.id, run.user_id);
            await requeueQueue.add('run', data, { delay: config.requeueDelayMs });
            return;
        }
        try {
            const cookies = await captureCookiesFromSession({
                sessionId: pending.sessionId,
                connectUrl: pending.connectUrl,
                wsEndpoint: pending.wsEndpoint,
                expiresAt: pending.expiresAt,
            });
            if (!cookies.length) {
                await requeueQueue.add('run', data, { delay: config.requeueDelayMs });
                return;
            }
            await saveSession(run.user_id, cookies, pending.expiresAt);
            session = { id: 'captured', cookies, expiresAt: pending.expiresAt ?? null };
        }
        catch (error) {
            logger.warn({ runId: run.id, error }, 'Login session not ready, requeueing');
            await requeueQueue.add('run', data, { delay: config.requeueDelayMs });
            return;
        }
    }
    const scraper = new RemoteScraper({
        wsEndpoint: config.browserlessWsUrl,
        token: config.browserlessToken,
        cookies: session.cookies,
    });
    try {
        await scraper.init();
        await updateRunStatus(run.id, 'running');
        const scrapeResult = await scraper.scrapeProfiles(run.config.profileUrls, run.config.postLimit, run.config.topics);
        const AnalyzerCtor = await loadInsightAnalyzerCtor();
        const analyzer = new AnalyzerCtor();
        const aggregateAnalysis = await analyzer.analyzeInsights(scrapeResult.allPosts, {
            linkedinUsername: '',
            postLimit: run.config.postLimit,
            focusTopics: run.config.topics,
            outputFormat: run.config.outputFormat === 'ai-ready' ? 'instructions' : 'markdown',
        });
        const perExpertAnalysis = {};
        for (const [username, posts] of Object.entries(scrapeResult.byExpert)) {
            perExpertAnalysis[username] = await analyzer.analyzeInsights(posts, {
                linkedinUsername: username,
                postLimit: run.config.postLimit,
                focusTopics: run.config.topics,
                outputFormat: 'instructions',
            });
        }
        const formatter = await loadFormatterInstance();
        const bundle = await buildKnowledgeBundle(aggregateAnalysis, perExpertAnalysis, formatter, run.config.topics, run.config.postLimit);
        await storeArtifact(run.id, 'instructions', bundle.instructionsMarkdown);
        for (const expertFile of bundle.expertMarkdownFiles) {
            await storeArtifact(run.id, `expert-${expertFile.username}`, expertFile.content);
        }
        const refreshedCookies = await scraper.exportCookies();
        if (refreshedCookies.length) {
            await saveSession(run.user_id, refreshedCookies, session.expiresAt ?? undefined);
        }
        const tokensUsed = aggregateAnalysis.tokenUsage ?? 0;
        await incrementTokenUsage(run.user_id, tokensUsed);
        const supabase = getSupabase();
        await supabase
            .from('runs')
            .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            token_estimate: tokensUsed,
            cost_estimate: Number(((tokensUsed / 1000000) * config.costPerMillionTokens).toFixed(4)),
        })
            .eq('id', run.id);
        await supabase.from('run_events').insert({
            run_id: run.id,
            event_type: 'completed',
            payload: {
                tokensUsed,
                expertsAnalyzed: Object.keys(scrapeResult.byExpert).length,
                postsAnalyzed: scrapeResult.allPosts.length,
            },
        });
    }
    catch (error) {
        logger.error({ runId: run.id, error }, 'Run processing failed');
        await updateRunStatus(run.id, 'failed', { reason: error?.message ?? 'unknown_error' });
        throw error;
    }
    finally {
        await scraper.close();
    }
}
