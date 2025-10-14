import crypto from 'node:crypto';
import { getSupabase } from './supabase.js';
import { config } from './config.js';
import { logger } from './logger.js';
export async function storeArtifact(runId, artifactType, content) {
    const supabase = getSupabase();
    const bytes = Buffer.byteLength(content, 'utf-8');
    const sha = crypto.createHash('sha256').update(content).digest('hex');
    const path = `${runId}/${artifactType}.md`;
    const { error: uploadError } = await supabase.storage
        .from(config.artifactBucket)
        .upload(path, content, { contentType: 'text/markdown', upsert: true });
    if (uploadError)
        throw uploadError;
    const { error: insertError } = await supabase.from('run_artifacts').insert({
        run_id: runId,
        artifact_type: artifactType,
        storage_path: path,
        content_sha256: sha,
        bytes,
    });
    if (insertError)
        throw insertError;
}
export async function saveScrapeCache(runId, username, posts) {
    const supabase = getSupabase();
    const path = `${runId}/_cache/${username}-posts.json`;
    const content = JSON.stringify(posts, null, 2);
    const { error: uploadError } = await supabase.storage
        .from(config.artifactBucket)
        .upload(path, content, { contentType: 'application/json', upsert: true });
    if (uploadError) {
        logger.warn({ runId, username, error: uploadError }, 'Failed to save scrape cache');
        return;
    }
    logger.info({ runId, username, postCount: posts.length }, 'Saved scrape cache');
}
export async function loadScrapeCache(runId, username) {
    const supabase = getSupabase();
    const path = `${runId}/_cache/${username}-posts.json`;
    const { data, error } = await supabase.storage
        .from(config.artifactBucket)
        .download(path);
    if (error) {
        logger.debug({ runId, username, error }, 'No scrape cache found');
        return null;
    }
    try {
        const text = await data.text();
        const posts = JSON.parse(text);
        logger.info({ runId, username, postCount: posts.length }, 'Loaded scrape cache');
        return posts;
    }
    catch (parseError) {
        logger.warn({ runId, username, error: parseError }, 'Failed to parse scrape cache');
        return null;
    }
}
