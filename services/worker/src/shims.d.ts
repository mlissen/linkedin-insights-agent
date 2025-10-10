declare module '@supabase/supabase-js' {
  export interface SupabaseClient {
    from(table: string): any;
    rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: any }>;
    auth: {
      getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: any }>;
    };
    storage: {
      from(bucket: string): {
        upload(
          path: string,
          data: unknown,
          options?: Record<string, unknown>,
        ): Promise<{ error: any }>;
      };
    };
  }
  export function createClient(
    url: string,
    key: string,
    options?: Record<string, unknown>,
  ): SupabaseClient;
}

declare module 'bullmq' {
  export class Queue<T = unknown> {
    constructor(name: string, options?: Record<string, unknown>);
    add(name: string, data: T, options?: Record<string, unknown>): Promise<unknown>;
  }
  export class Worker<T = unknown> {
    constructor(
      name: string,
      processor: (job: Job<T>) => Promise<unknown>,
      options?: Record<string, unknown>,
    );
    on(event: 'completed', handler: (job: Job<T>) => void): void;
    on(event: 'failed', handler: (job: Job<T> | undefined, error: unknown) => void): void;
  }
  export interface Job<T = unknown> {
    id: string;
    data: T;
  }
}

declare module 'node-fetch' {
  const fetch: (url: string, init?: Record<string, unknown>) => Promise<any>;
  export default fetch;
}

declare module 'pino' {
  export interface Logger {
    info(message: unknown, context?: unknown): void;
    error(message: unknown, context?: unknown): void;
    warn(message: unknown, context?: unknown): void;
    debug(message: unknown, context?: unknown): void;
  }
  export default function pino(options?: Record<string, unknown>): Logger;
}

declare module 'puppeteer' {
  export interface Browser {
    newPage(): Promise<Page>;
    pages(): Promise<Page[]>;
    close(): Promise<void>;
    disconnect(): Promise<void>;
  }
  export interface Page {
    setViewport(viewport: { width: number; height: number }): Promise<void>;
    setUserAgent(userAgent: string): Promise<void>;
    setCookie(...cookies: Protocol.Network.CookieParam[]): Promise<void>;
    goto(url: string, options?: Record<string, unknown>): Promise<void>;
    waitForTimeout(ms: number): Promise<void>;
    evaluate<T>(fn: () => T): Promise<T>;
    content(): Promise<string>;
    $(selector: string): Promise<unknown>;
    cookies(url: string): Promise<Protocol.Network.Cookie[]>;
  }
  export namespace Protocol {
    namespace Network {
      interface Cookie {
        name: string;
        value: string;
        domain: string;
        path: string;
        expires: number;
        httpOnly: boolean;
        secure: boolean;
        sameSite?: 'Strict' | 'Lax' | 'None';
      }
      interface CookieParam {
        name: string;
        value: string;
        domain: string;
        path: string;
        expires?: number;
        httpOnly: boolean;
        secure: boolean;
        sameSite?: 'Strict' | 'Lax' | 'None';
      }
    }
  }
  export function connect(options: Record<string, unknown>): Promise<Browser>;
  const puppeteer: {
    connect: typeof connect;
  };
  export default puppeteer;
}

declare module 'cheerio' {
  export type Cheerio = any;
  export function load(html: string): any;
}

declare module '../../../src/types.ts' {
  export interface InsightAnalysis {
    actionableInstructions?: string[];
    posts?: Array<Record<string, unknown>>;
    tokenUsage?: number;
    [key: string]: unknown;
  }
  export interface LinkedInPost {
    id: string;
    content: string;
    publishedAt: string;
    engagement: { likes: number; comments: number; shares: number };
    url: string;
    author: string;
  }
  export interface ScrapingConfig {
    linkedinUsername: string;
    focusTopics: string[];
    postLimit: number;
    outputFormat: string;
  }
}

declare module '../../../src/analyzer.ts' {
  export class InsightAnalyzer {
    analyzeInsights(posts: unknown[], config: Record<string, unknown>): Promise<any>;
  }
}

declare module '../../../src/analyzer.js' {
  export class InsightAnalyzer {
    analyzeInsights(posts: unknown[], config: Record<string, unknown>): Promise<any>;
  }
}

declare module '../../../src/three-file-formatter.ts' {
  export class ThreeFileFormatter {
    formatThreeFiles(
      analysis: unknown,
      config: Record<string, unknown>,
    ): {
      knowledgeBase: string;
      coreRules: string;
      projectInstructions: string;
    };
  }
}

declare module '../../../src/three-file-formatter.js' {
  export class ThreeFileFormatter {
    formatThreeFiles(
      analysis: unknown,
      config: Record<string, unknown>,
    ): Promise<{
      knowledgeBase: string;
      coreRules: string;
      projectInstructions: string;
    }>;
  }
}
