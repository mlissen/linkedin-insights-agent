import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import * as processor from '../src/run-processor.js';
import * as supabaseMod from '../src/supabase.js';
import * as loginMod from '../src/browser-login.js';
import { Queue } from 'bullmq';

vi.mock('../src/config.js', () => ({
  config: {
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceKey: 'service-key',
    queueRedisUrl: 'redis://localhost:6379',
    browserlessHttpUrl: 'https://browserless-http',
    browserlessWsUrl: 'wss://browserless-ws',
    browserlessToken: 'token',
    artifactBucket: 'runs',
    maxRunMinutes: 20,
    requeueDelayMs: 5000,
    encryptionKey: 'secret',
    costPerMillionTokens: 15,
  },
}));
vi.mock('../src/supabase.js', () => ({
  getSupabase: vi.fn(),
}));
vi.mock('../src/browser-login.js', () => ({
  ensureLoginSession: vi.fn(),
  captureCookiesFromSession: vi.fn(),
  encryptCookies: vi.fn().mockReturnValue({ payload: 'encrypted' }),
  decryptCookies: vi.fn().mockReturnValue([]),
}));
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));
vi.mock('puppeteer', () => ({
  connect: vi.fn(),
}));
vi.mock('../src/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
  })),
  Job: class {},
}));
vi.mock('../src/remote-scraper.js', () => ({
  RemoteScraper: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    scrapeProfiles: vi.fn().mockResolvedValue({ allPosts: [], byExpert: {} }),
    exportCookies: vi.fn().mockResolvedValue([]),
    close: vi.fn(),
  })),
}));
vi.mock('../../../src/analyzer.ts', () => ({
  InsightAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeInsights: vi.fn().mockResolvedValue({ tokenUsage: 0, insights: [], templates: [] }),
  })),
}));
vi.mock('../../../src/three-file-formatter.ts', () => ({
  ThreeFileFormatter: vi.fn().mockImplementation(() => ({
    formatThreeFiles: vi.fn().mockReturnValue({
      knowledgeBase: '# Knowledge',
      coreRules: '',
      projectInstructions: '',
    }),
  })),
}));
vi.mock('../src/storage.js', () => ({
  storeArtifact: vi.fn().mockResolvedValue(undefined),
}));

describe('processRunJob', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    const supabaseStub = {
      storage: {
        from: () => ({
          upload: async () => ({ error: null }),
        }),
      },
      from(table: string) {
        if (table === 'runs') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 'run',
                    user_id: 'user',
                    status: 'queued',
                    config: {
                      profileUrls: ['https://www.linkedin.com/in/test/'],
                      topics: [],
                      outputFormat: 'ai-ready',
                      postLimit: 50,
                    },
                  },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: () => ({ error: null }),
            }),
          };
        }

        if (table === 'linked_sessions') {
          const chain = {
            eq: () => chain,
            order: () => ({
              limit: () => ({
                single: async () => ({ data: null, error: null }),
              }),
            }),
            single: async () => ({ data: null, error: null }),
            update: () => ({ eq: () => ({}) }),
            insert: async () => ({ error: null }),
          };
          return {
            select: () => chain,
            update: () => ({ eq: () => ({ error: null }) }),
            insert: async () => ({ error: null }),
          };
        }

        if (table === 'run_events') {
          const chain = {
            eq: () => chain,
            order: () => ({
              limit: () => ({
                single: async () => ({ data: null, error: null }),
              }),
            }),
            single: async () => ({ data: null, error: null }),
          };
          return {
            select: () => chain,
            insert: async () => ({ error: null }),
          };
        }

        if (table === 'usage_counters') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({ data: null, error: { code: 'PGRST116' } }),
                }),
              }),
            }),
            upsert: async () => ({ error: null }),
          };
        }

        if (table === 'linked_sessions_update') {
          return { update: () => ({ eq: () => ({ error: null }) }) };
        }

        return {
          insert: async () => ({ error: null }),
          update: () => ({ eq: () => ({ error: null }) }),
        };
      },
    } as unknown as { from: (...args: unknown[]) => unknown };

    (supabaseMod.getSupabase as unknown as Mock).mockReturnValue(supabaseStub);
    (Queue as unknown as Mock).mockReturnValue({ add: vi.fn() });
  });

  it('requests login when no active session', async () => {
    (loginMod.ensureLoginSession as unknown as Mock).mockResolvedValue(undefined);
    (loginMod.decryptCookies as unknown as Mock).mockReturnValue([]);

    await processor.processRunJob({ runId: 'run', userId: 'user' }, {
      data: { runId: 'run', userId: 'user' },
    } as any);

    expect(loginMod.ensureLoginSession).toHaveBeenCalledWith('run', 'user');
  });
});
