const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  "http://localhost:5200/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
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
  const res = await fetch(`${API_BASE_URL}${path}`, init);

  if (!res.ok) {
    throw new ApiError(res.status, await extractErrorMessage(res));
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

/**
 * Binary counterpart of {@link apiFetch} — for endpoints that stream raw bytes
 * (e.g. the original document file) rather than JSON. Shares the base URL and
 * `ApiError` handling so auth/credentials policy stays centralised in one place
 * (today: none, matching apiFetch — auth is deferred, Roadmap #2).
 */
export async function apiFetchBinary(path: string): Promise<ArrayBuffer> {
  const res = await fetch(`${API_BASE_URL}${path}`);

  if (!res.ok) {
    throw new ApiError(res.status, await extractErrorMessage(res));
  }

  return res.arrayBuffer();
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string | Array<string> };
    if (Array.isArray(body.message)) return body.message.join(", ");
    if (typeof body.message === "string") return body.message;
  } catch {
    // Response had no/invalid JSON body — fall back below.
  }
  return res.statusText || `Request failed with status ${res.status}`;
}
