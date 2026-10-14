import { test, expect } from "@/fixtures";
import type { HttpMethod } from "@/api/http.client";
import { findDocument } from "@/utils/db";
import { createGuestUser, createSignedInUser, deleteUsers, documentOwner, liveCookie } from "@/utils/sessions";

// Ported from server/test/access-matrix.e2e-spec.ts. Every case is decided by the guard or by validation before any
// AI provider is reached, so the whole matrix runs live against the dev server.

const UNKNOWN = "11111111-2222-4333-8444-555555555555";

test.describe("Access matrix (e2e) — design §5.2", () => {
  let guestCookie: string;
  let userCookie: string;
  let guestId: string;
  let userId: string;
  const users: string[] = [];

  test.beforeAll(async () => {
    const g = await createGuestUser();
    const u = await createSignedInUser();
    guestCookie = g.cookie;
    userCookie = u.cookie;
    guestId = g.userId;
    userId = u.userId;
    users.push(g.userId, u.userId);
  });

  test.afterAll(async () => {
    await deleteUsers(users);
  });

  const lower = (m: HttpMethod) => m.toLowerCase();

  test("health is public", async ({ http }) => {
    expect((await http().get("/health")).status).toBe(200);
  });

  for (const [m, p] of [
    ["GET", `/documents/${UNKNOWN}`],
    ["GET", `/documents/${UNKNOWN}/file`],
    ["GET", `/match/runs/${UNKNOWN}`],
    ["GET", `/match/${UNKNOWN}`],
    ["POST", "/match"],
    ["POST", "/match/runs"],
  ] as const) {
    test(`${lower(m)} ${p}: anonymous 401, guest and user pass the guard`, async ({ http }) => {
      expect((await http().call(m, p)).status).toBe(401);
      expect((await http(guestCookie).call(m, p)).status).not.toBe(401);
      expect((await http(userCookie).call(m, p)).status).not.toBe(401);
    });
  }

  for (const [m, p] of [
    ["GET", "/documents"],
    ["GET", "/match"],
    ["GET", "/ai-credentials"],
    ["GET", "/cover-letters"],
    ["GET", "/me/export"],
    ["PATCH", `/documents/${UNKNOWN}`],
    ["DELETE", `/documents/${UNKNOWN}`],
    ["GET", `/comparisons/${UNKNOWN}`],
    ["GET", "/ai-credentials/providers"],
    ["POST", "/ai-credentials"],
    ["PATCH", `/ai-credentials/${UNKNOWN}`],
    ["DELETE", `/ai-credentials/${UNKNOWN}`],
    ["POST", `/ai-credentials/${UNKNOWN}/test`],
    ["POST", "/cover-letters"],
    ["PATCH", `/cover-letters/${UNKNOWN}`],
    ["DELETE", `/cover-letters/${UNKNOWN}`],
    ["POST", "/cv-rewrite"],
    ["POST", "/cv-rewrite/accept"],
    ["PATCH", `/documents/${UNKNOWN}/parent`],
  ] as const) {
    test(`${lower(m)} ${p}: user only`, async ({ http }) => {
      expect((await http().call(m, p)).status).toBe(401);
      expect((await http(guestCookie).call(m, p)).status).toBe(401);
      expect((await http(userCookie).call(m, p)).status).not.toBe(401);
    });
  }

  test("POST /documents by an anonymous caller creates a guest and sets mcv_session", async ({ http }) => {
    const res = await http().post("/documents", {
      data: {
        kind: "JD",
        sourceText: "Senior Frontend Engineer — React, TypeScript",
        save: false,
      },
    });
    expect(res.status).toBe(201);
    const owner = await documentOwner((res.body as { id: string }).id);
    if (owner) users.push(owner.userId);
    const setCookie = res.setCookies.join(",");
    expect(setCookie).toMatch(/mcv_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(owner?.isGuest).toBe(true);
    const newCookie = liveCookie(res.setCookies, "mcv_session")!;
    expect((await http(newCookie).get("/documents")).status).toBe(401);
  });

  for (const [who, cookie, id] of [
    ["guest", () => guestCookie, () => guestId],
    ["signed-in user", () => userCookie, () => userId],
  ] as const) {
    test(`POST /documents as ${who} passes the guard and creates no new guest`, async ({ http }) => {
      const res = await http(cookie()).post("/documents", {
        data: {
          kind: "JD",
          sourceText: "Senior Frontend Engineer — React, TypeScript",
          save: false,
        },
      });
      expect(res.status).toBe(201);
      const doc = await findDocument((res.body as { id: string }).id);
      expect(doc?.userId).toBe(id());
      expect(res.setCookies.join(",")).not.toMatch(/mcv_session=[^;]+/);
    });
  }

  test("a 401 body carries code SIGN_IN_REQUIRED", async ({ http }) => {
    const res = await http().get("/documents");
    expect(res.status).toBe(401);
    expect((res.body as { code: string }).code).toBe("SIGN_IN_REQUIRED");
  });
});
