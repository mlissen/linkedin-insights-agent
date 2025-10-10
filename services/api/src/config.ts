import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.API_PORT ?? 4000),
  supabaseUrl: requireEnv('SUPABASE_URL'),
  supabaseServiceKey: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  queueRedisUrl: requireEnv('RUN_QUEUE_REDIS_URL'),
  supabaseJwtSecret: requireEnv('SUPABASE_JWT_SECRET'),
  runLimit: Number(process.env.RUN_LIMIT ?? 5),
  costPerMillionTokens: Number(process.env.COST_PER_M_TOKEN ?? 15),
  corsOrigin: process.env.API_CORS_ORIGIN ?? '*',
} as const;
