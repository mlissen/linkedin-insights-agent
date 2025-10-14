import dotenv from 'dotenv';
dotenv.config();
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing env var ${name}`);
    }
    return value;
}
export const config = {
    supabaseUrl: requireEnv('SUPABASE_URL'),
    supabaseServiceKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    queueRedisUrl: requireEnv('RUN_QUEUE_REDIS_URL'),
    browserlessHttpUrl: requireEnv('BROWSERLESS_HTTP_URL'),
    browserlessWsUrl: requireEnv('BROWSERLESS_WS_URL'),
    browserlessToken: requireEnv('BROWSERLESS_TOKEN'),
    artifactBucket: process.env.RUN_ARTIFACT_BUCKET ?? 'runs',
    maxRunMinutes: Number(process.env.RUN_MAX_MINUTES ?? 20),
    requeueDelayMs: Number(process.env.RUN_REQUEUE_DELAY_MS ?? 5000),
    encryptionKey: requireEnv('SESSION_ENCRYPTION_KEY'),
    costPerMillionTokens: Number(process.env.COST_PER_M_TOKEN ?? 15),
};
