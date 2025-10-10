import crypto from 'node:crypto';
import { Protocol } from 'puppeteer';
import { createSession, connectToSession, type BrowserlessSession } from './browserless-client.js';
import { config } from './config.js';
import { getSupabase } from './supabase.js';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';

function encryptionKey(): Buffer {
  return crypto.createHash('sha256').update(config.encryptionKey).digest();
}

export function encryptCookies(cookies: Protocol.Network.Cookie[]): { payload: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey(), iv);
  const serialized = Buffer.from(JSON.stringify(cookies), 'utf-8');
  const cipherText = Buffer.concat([cipher.update(serialized), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, authTag, cipherText]).toString('base64');
  return { payload };
}

export function decryptCookies(payload: string): Protocol.Network.Cookie[] {
  const buffer = Buffer.from(payload, 'base64');
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const cipherText = buffer.subarray(28);
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return JSON.parse(decrypted.toString('utf-8'));
}

export async function ensureLoginSession(runId: string, userId: string) {
  const session = await createSession({ headless: false });
  const supabase = getSupabase();

  const { error: updateError } = await supabase
    .from('runs')
    .update({
      status: 'needs_login',
      needs_login_url: session.connectUrl,
    })
    .eq('id', runId);
  if (updateError) throw updateError;

  const { error: insertError } = await supabase.from('run_events').insert({
    run_id: runId,
    event_type: 'needs_login',
    payload: {
      sessionId: session.sessionId,
      connectUrl: session.connectUrl,
      wsEndpoint: session.wsEndpoint,
      expiresAt: session.expiresAt,
      userId,
    },
  });
  if (insertError) throw insertError;

  logger.info({ runId, sessionId: session.sessionId }, 'Login session provisioned');
}

export async function captureCookiesFromSession(
  session: BrowserlessSession,
): Promise<Protocol.Network.Cookie[]> {
  const browser = await connectToSession(session.wsEndpoint);
  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();

  await page.waitForTimeout(2000);
  const cookies = await page.cookies('https://www.linkedin.com/');
  await browser.disconnect();
  return cookies;
}
