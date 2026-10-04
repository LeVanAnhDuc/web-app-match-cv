import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMe, logout } from "#/requests/auth";
import { ApiError, apiFetch, signInUrl } from "#/libs/api";

const BASE = "http://localhost:5200/api/v1";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchMe", () => {
  it("GETs /auth/me with the session cookie", async () => {
    const me = { status: "anonymous", user: null, guestQuota: null };
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 200, json: async () => me }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchMe()).resolves.toEqual(me);
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/auth/me`, {
      credentials: "include"
    });
  });
});

describe("logout", () => {
  it("POSTs /auth/logout with credentials and resolves on 204", async () => {
    const fetchMock = vi.fn(
      async () => ({ ok: true, status: 204 }) as Response
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(logout()).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(`${BASE}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
  });
});

describe("signInUrl", () => {
  it("encodes returnTo into the login URL", () => {
    expect(signInUrl("/wizard?runId=1")).toBe(
      `${BASE}/auth/login?returnTo=${encodeURIComponent("/wizard?runId=1")}`
    );
  });
});

describe("ApiError", () => {
  it("exposes code and body from a 429 quota response", async () => {
    const body = {
      statusCode: 429,
      message: "Quota",
      code: "GUEST_QUOTA_EXCEEDED",
      limit: 5,
      resetsAt: "2026-10-05T00:00:00.000Z"
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => body
      }))
    );

    const err = await apiFetch("/match").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      status: 429,
      message: "Quota",
      code: "GUEST_QUOTA_EXCEEDED",
      body
    });
  });
});
