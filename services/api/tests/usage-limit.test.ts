/// <reference types="vitest" />
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import * as runService from '../src/services/run-service.js';
import { getSupabase } from '../src/supabase.js';
import { supabaseAuth } from '../src/middleware/auth.js';
import jwt from 'jsonwebtoken';

vi.mock('../src/supabase.js');
vi.mock('../src/queue.js', () => ({
  runQueue: { add: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('../src/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));
 (vi as any).mock(
  'jsonwebtoken',
  () => ({
    default: {
      verify: vi.fn(),
    },
  }),
  { virtual: true },
);
vi.mock('../src/config.js', () => ({
  config: {
    port: 4000,
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceKey: 'service-key',
    queueRedisUrl: 'redis://localhost:6379',
    supabaseJwtSecret: 'jwt-secret',
    runLimit: 5,
    costPerMillionTokens: 15,
    corsOrigin: '*',
  },
}));
 (vi as any).mock(
  '@supabase/supabase-js',
  () => ({
    createClient: vi.fn(() => ({
      from: vi.fn(),
      rpc: vi.fn(),
      auth: { getUser: vi.fn() },
    })),
  }),
  { virtual: true },
);

describe('run limit enforcement', () => {
  const mockClient: any = { from: vi.fn(), rpc: vi.fn() };

  beforeEach(() => {
    vi.resetAllMocks();
    (getSupabase as unknown as Mock).mockReturnValue(mockClient);
  });

  it('allows runs when under limit', async () => {
    mockClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { runs_used: 3 }, error: null }),
          }),
        }),
      }),
    });

    const remaining = await runService.checkRunLimit('user-1');
    expect(remaining).toBeGreaterThan(0);
  });

  it('throws when limit reached', async () => {
    mockClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { runs_used: 5 }, error: null }),
          }),
        }),
      }),
    });

    await expect(runService.checkRunLimit('user-1')).rejects.toThrow('Run limit reached');
  });

  it('rejects missing bearer token', () => {
    const req: any = { header: vi.fn().mockReturnValue(undefined) };
    const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };
    const next = vi.fn();
    supabaseAuth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid Supabase JWT', () => {
    const token = 'valid';
    const req: any = {
      header: vi
        .fn()
        .mockImplementation((key) => (key === 'authorization' ? `Bearer ${token}` : undefined)),
    };
    const res: any = { status: vi.fn().mockReturnValue({ json: vi.fn() }) };
    const next = vi.fn();
    (jwt.verify as unknown as Mock).mockReturnValue({ sub: 'user-id', email: 'a@example.com' });
    supabaseAuth(req, res, next);
    expect(req.auth?.userId).toBe('user-id');
    expect(next).toHaveBeenCalled();
  });
});
