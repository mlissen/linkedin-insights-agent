import fetch from 'node-fetch';
import puppeteer from 'puppeteer';
import { config } from './config.js';
import { logger } from './logger.js';
export async function createSession(options) {
    const response = await fetch(`${config.browserlessHttpUrl}/sessions?token=${config.browserlessToken}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
            headless: options.headless,
            keepAlive: options.keepAlive ?? true,
            blockAds: true,
            recordVideo: false,
            timeout: config.maxRunMinutes * 60 * 1000,
        }),
    });
    if (!response.ok) {
        const text = await response.text();
        logger.error({ status: response.status, text }, 'Failed to create Browserless session');
        throw new Error('Browserless session provision failed');
    }
    const payload = (await response.json());
    return {
        sessionId: payload.id,
        connectUrl: payload.connectUrl,
        wsEndpoint: payload.wsEndpoint,
        expiresAt: payload.expiresAt,
    };
}
export async function connectToSession(wsEndpoint) {
    const endpoint = `${wsEndpoint}?token=${config.browserlessToken}`;
    return puppeteer.connect({
        browserWSEndpoint: endpoint,
        ignoreHTTPSErrors: true,
        defaultViewport: { width: 1280, height: 720 },
    });
}
