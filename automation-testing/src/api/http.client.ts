import type { APIRequest } from "@playwright/test";

// Thin HTTP client over Playwright's APIRequest for the API specs (tests/api/**). Every call runs in a FRESH request
// context and disposes it straight away, so no cookie jar carries over between calls: a Set-Cookie from one response
// (e.g. the guest session minted by an anonymous POST /documents) never leaks into the next request. Identity is
// whatever `Cookie` the caller passes, exactly like the supertest suite this replaces. The body is buffered before the
// context goes away, so a response stays readable for the rest of the test.

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export interface CallOptions {
  /** JSON body (serialised by Playwright, content-type set to application/json). */
  data?: unknown;
  /** multipart/form-data body: string fields and files. */
  multipart?: Record<string, string | { name: string; mimeType: string; buffer: Buffer }>;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  /** Redirects to follow. Default 0: a 302 is returned as is (supertest behaviour). */
  maxRedirects?: number;
}

export interface HttpResponse {
  status: number;
  /** Lower-cased header names; the last value wins. Use `setCookies` for Set-Cookie. */
  headers: Record<string, string>;
  /** Every Set-Cookie header, in order. */
  setCookies: string[];
  /** Raw bytes of the body. */
  raw: Buffer;
  /** Parsed JSON when the response is JSON, otherwise the raw bytes. */
  body: unknown;
  text: string;
}

export interface Http {
  get(path: string, options?: CallOptions): Promise<HttpResponse>;
  post(path: string, options?: CallOptions): Promise<HttpResponse>;
  patch(path: string, options?: CallOptions): Promise<HttpResponse>;
  delete(path: string, options?: CallOptions): Promise<HttpResponse>;
  call(method: HttpMethod, path: string, options?: CallOptions): Promise<HttpResponse>;
}

/** `cookie` is a full `name=value[; name2=value2]` Cookie header, or undefined for an anonymous caller. */
export type HttpFactory = (cookie?: string) => Http;

// The API throttles per route per IP (global 100/min, tighter on a few routes). A suite run serially against one dev
// server can cross that where the in-process Jest suite (a fresh app per file) never did. A throttler 429 carries
// Retry-After; a business 429 (guest quota) does not, so only the former is waited out and retried.
const MAX_THROTTLE_RETRIES = 2;

function toResponse(status: number, headersArray: { name: string; value: string }[], raw: Buffer): HttpResponse {
  const headers: Record<string, string> = {};
  const setCookies: string[] = [];
  for (const { name, value } of headersArray) {
    const key = name.toLowerCase();
    if (key === "set-cookie") setCookies.push(value);
    headers[key] = value;
  }
  const text = raw.toString("utf8");
  let body: unknown = raw;
  if ((headers["content-type"] ?? "").includes("json") && text.length) {
    try {
      body = JSON.parse(text);
    } catch {
      body = raw;
    }
  }
  return { status, headers, setCookies, raw, body, text };
}

export function createHttp(
  request: APIRequest,
  apiUrl: string,
  onThrottleWait: (ms: number) => void = () => undefined
): HttpFactory {
  const root = apiUrl.replace(/\/$/, "");

  async function once(method: HttpMethod, path: string, cookie: string | undefined, options: CallOptions) {
    const context = await request.newContext({
      storageState: { cookies: [], origins: [] },
      extraHTTPHeaders: cookie ? { Cookie: cookie } : {},
    });
    try {
      const res = await context.fetch(`${root}${path}`, {
        method,
        data: options.data,
        multipart: options.multipart,
        params: options.params,
        headers: options.headers,
        maxRedirects: options.maxRedirects ?? 0,
        failOnStatusCode: false,
      });
      return toResponse(res.status(), res.headersArray(), await res.body());
    } finally {
      await context.dispose();
    }
  }

  return (cookie?: string): Http => {
    const call = async (method: HttpMethod, path: string, options: CallOptions = {}) => {
      for (let attempt = 0; ; attempt += 1) {
        const res = await once(method, path, cookie, options);
        const retryAfter = Number(res.headers["retry-after"]);
        if (res.status !== 429 || !Number.isFinite(retryAfter) || attempt >= MAX_THROTTLE_RETRIES) return res;
        const waitMs = (retryAfter + 1) * 1000;
        onThrottleWait(waitMs);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    };
    return {
      call,
      get: (path, options) => call("GET", path, options),
      post: (path, options) => call("POST", path, options),
      patch: (path, options) => call("PATCH", path, options),
      delete: (path, options) => call("DELETE", path, options),
    };
  };
}
