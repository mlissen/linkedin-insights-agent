declare module '@supabase/supabase-js' {
  export interface SupabaseClient {
    from(table: string): any;
    rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: any }>;
    auth: {
      getUser(token: string): Promise<{ data: { user: { id: string } | null }; error: any }>;
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
}

declare module 'cors' {
  export default function cors(
    options?: Record<string, unknown>,
  ): (req: unknown, res: unknown, next: unknown) => void;
}

declare module 'express' {
  export interface Request {
    auth?: import('./types.js').AuthContext;
    body?: unknown;
    params: Record<string, string>;
    header(name: string): string | undefined;
  }

  export interface Response {
    status(code: number): Response;
    json(payload: unknown): Response;
  }

  export type NextFunction = (error?: unknown) => void;

  export interface Router {
    use(...handlers: unknown[]): Router;
    get(
      path: string,
      handler: (req: Request, res: Response, next: NextFunction) => unknown,
    ): Router;
    post(
      path: string,
      handler: (req: Request, res: Response, next: NextFunction) => unknown,
    ): Router;
  }

  export interface Application extends Router {
    listen(port: number, callback?: () => void): void;
  }

  export interface ExpressStatic {
    (): Application;
    Router(): Router;
    json(...args: unknown[]): unknown;
  }

  export function Router(): Router;

  const express: ExpressStatic;
  export default express;
}

declare module 'jsonwebtoken' {
  export function verify(token: string, secretOrPublicKey: string): unknown;
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
