export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:5200/api/v1";

export class ApiError extends Error {
  status: number;
  code?: string;
  body?: unknown;

  constructor(status: number, message: string, code?: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

/** Full-page sign-in URL — navigate to it, never fetch it (design 5.1). */
export function signInUrl(returnTo: string): string {
  return `${API_BASE_URL}/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Minimal fetch wrapper against the API contract in
 * docs/specs/cv-jd-matching-wizard/plan.md. Callers pass `init.body` as
 * either a JSON string (with a matching Content-Type header) or a
 * `FormData` instance for multipart requests.
 */
export async function apiFetch<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include"
  });

  if (!res.ok) {
    throw await toApiError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

/**
 * Binary counterpart of {@link apiFetch} — for endpoints that stream raw bytes
 * (e.g. the original document file) rather than JSON. Shares the base URL and
 * `ApiError` handling so the credentials policy (session cookie sent on every
 * request) stays centralised in one place.
 */
export async function apiFetchBinary(path: string): Promise<ArrayBuffer> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include"
  });

  if (!res.ok) {
    throw await toApiError(res);
  }

  return res.arrayBuffer();
}

async function toApiError(res: Response): Promise<ApiError> {
  const { message, code, body } = await extractError(res);
  return new ApiError(res.status, message, code, body);
}

async function extractError(
  res: Response
): Promise<{ message: string; code?: string; body?: unknown }> {
  const fallback = res.statusText || `Request failed with status ${res.status}`;
  try {
    const body = (await res.json()) as {
      message?: string | Array<string>;
      code?: string;
    };
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : typeof body.message === "string"
        ? body.message
        : fallback;
    return {
      message,
      code: typeof body.code === "string" ? body.code : undefined,
      body
    };
  } catch {
    // Response had no/invalid JSON body — fall back below.
  }
  return { message: fallback };
}
