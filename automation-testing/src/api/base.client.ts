import type { CallOptions, Http, HttpFactory, HttpMethod, HttpResponse } from "./http.client";

// Shared plumbing for every <resource>.client.ts: who is calling (a Cookie header, or nobody), which language the
// server should answer in, and a typed view of the response. Built on http.client.ts, so every call still runs in a
// fresh request context (no cookie jar leaks between calls) and waits out a throttler 429 once or twice.

/**
 * Who the call runs as:
 * - `undefined`            anonymous (no Cookie header)
 * - `"mcv_session=…"`      a full Cookie header value
 * - `["a=1", "b=2"]`       several cookies, joined with "; " (e.g. a session plus `mcv_oauth` for /auth/callback)
 * - `{ cookie }`           a SeededUser from utils/sessions.ts
 * - `() => string`         resolved on every call (the seeded e2e user, whose cookie file exists only after setup)
 */
export type Identity = string | string[] | { cookie: string } | (() => string) | undefined;

export type Lang = "en" | "vi";

export interface BindOptions {
  /** Sent as `Accept-Language`; the server resolves `?lang=` first, then this header (app.module.ts). */
  lang?: Lang;
  /** Headers added to every call of this client. */
  headers?: Record<string, string>;
}

/**
 * Error envelope: Nest's default (HttpException / ValidationPipe — `message` is an array for DTO validation errors),
 * or the app's own `{ code, message }` (e.g. 401 `{ code: "SIGN_IN_REQUIRED", message }`, message in the request's
 * language).
 */
export interface ApiErrorBody {
  code?: string;
  statusCode?: number;
  message: string | string[];
  error?: string;
  [key: string]: unknown;
}

export interface ApiResponse<T> extends HttpResponse {
  /** The body cast to the success DTO. No runtime check: assert `status` first. */
  json(): T;
  /** The body cast to Nest's error envelope. */
  error(): ApiErrorBody;
}

/**
 * Input of a write endpoint: the DTO's keys are suggested, but any value (wrong type, extra key, missing key) is
 * accepted so validation specs can send malformed bodies through the same method as the happy path.
 */
export type Loose<T> = { [K in keyof T]?: unknown } & Record<string, unknown>;

export interface FilePart {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

export interface BaseClient {
  request<T>(method: HttpMethod, path: string, options?: CallOptions): Promise<ApiResponse<T>>;
  /** Untyped escape hatch bound to the same identity and headers (any path, any method). */
  raw: Http;
  /** The Cookie header this client sends, or undefined when anonymous. */
  cookie(): string | undefined;
}

export function cookieOf(identity: Identity): string | undefined {
  if (identity === undefined) return undefined;
  if (typeof identity === "function") return identity();
  if (typeof identity === "string") return identity || undefined;
  if (Array.isArray(identity)) return identity.filter(Boolean).join("; ") || undefined;
  return identity.cookie;
}

function typed<T>(res: HttpResponse): ApiResponse<T> {
  return Object.assign(res, {
    json: () => res.body as T,
    error: () => res.body as ApiErrorBody,
  });
}

export function createBaseClient(factory: HttpFactory, identity: Identity, opts: BindOptions = {}): BaseClient {
  const defaults: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.lang) defaults["Accept-Language"] = opts.lang;
  const merge = (options: CallOptions = {}): CallOptions => ({
    ...options,
    headers: { ...defaults, ...(options.headers ?? {}) },
  });
  // Resolved per call: a lazy identity (the e2e user's cookie file) is read only when a request is actually made.
  const http = () => factory(cookieOf(identity));
  const raw: Http = {
    call: (method, path, options) => http().call(method, path, merge(options)),
    get: (path, options) => http().get(path, merge(options)),
    post: (path, options) => http().post(path, merge(options)),
    patch: (path, options) => http().patch(path, merge(options)),
    delete: (path, options) => http().delete(path, merge(options)),
  };
  return {
    raw,
    cookie: () => cookieOf(identity),
    request: async <T>(method: HttpMethod, path: string, options?: CallOptions) =>
      typed<T>(await raw.call(method, path, options)),
  };
}

/** Query params with undefined values dropped and booleans/numbers stringified. */
export function query(params: Record<string, unknown> | undefined): Record<string, string> | undefined {
  if (!params) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) out[key] = String(value);
  }
  return out;
}

/** Merge extra per-call options (headers, params) over the ones a client method builds. */
export function withOptions(base: CallOptions, extra?: CallOptions): CallOptions {
  if (!extra) return base;
  return {
    ...base,
    ...extra,
    params: { ...(base.params ?? {}), ...(extra.params ?? {}) },
    headers: { ...(base.headers ?? {}), ...(extra.headers ?? {}) },
  };
}
