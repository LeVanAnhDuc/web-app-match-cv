import request from "supertest";
import {
  createGuestUser,
  createSignedInUser,
  deleteUsers
} from "./helpers/auth";
import { createTestApp } from "./helpers/app";

const UNKNOWN = "11111111-2222-4333-8444-555555555555";

describe("Access matrix (e2e) — design §5.2", () => {
  let ctx: Awaited<ReturnType<typeof createTestApp>>;
  let guestCookie: string;
  let userCookie: string;
  let guestId: string;
  let userId: string;
  const users: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    const g = await createGuestUser(ctx.prisma);
    const u = await createSignedInUser(ctx.prisma);
    guestCookie = g.cookie;
    userCookie = u.cookie;
    guestId = g.userId;
    userId = u.userId;
    users.push(g.userId, u.userId);
  });

  afterAll(async () => {
    await deleteUsers(ctx.prisma, users);
    await ctx.app.close();
  });

  const call = (
    method: "get" | "post" | "patch" | "delete",
    path: string,
    cookie?: string
  ) => {
    const r = request(ctx.app.getHttpServer())[method](`/api/v1${path}`);
    return cookie ? r.set("Cookie", cookie) : r;
  };

  it("health is public", async () => {
    await call("get", "/health").expect(200);
  });

  it.each([
    ["get", `/documents/${UNKNOWN}`],
    ["get", `/documents/${UNKNOWN}/file`],
    ["get", `/match/runs/${UNKNOWN}`],
    ["get", `/match/${UNKNOWN}`],
    ["post", "/match"],
    ["post", "/match/runs"]
  ] as const)(
    "%s %s: anonymous 401, guest and user pass the guard",
    async (m, p) => {
      await call(m, p).expect(401);
      expect((await call(m, p, guestCookie)).status).not.toBe(401);
      expect((await call(m, p, userCookie)).status).not.toBe(401);
    }
  );

  it.each([
    ["get", "/documents"],
    ["get", "/match"],
    ["get", "/ai-credentials"],
    ["get", "/cover-letters"],
    ["get", "/me/export"],
    ["patch", `/documents/${UNKNOWN}`],
    ["delete", `/documents/${UNKNOWN}`],
    ["get", `/comparisons/${UNKNOWN}`],
    ["get", "/ai-credentials/providers"],
    ["post", "/ai-credentials"],
    ["patch", `/ai-credentials/${UNKNOWN}`],
    ["delete", `/ai-credentials/${UNKNOWN}`],
    ["post", `/ai-credentials/${UNKNOWN}/test`],
    ["post", "/cover-letters"],
    ["patch", `/cover-letters/${UNKNOWN}`],
    ["delete", `/cover-letters/${UNKNOWN}`],
    ["post", "/cv-rewrite"],
    ["post", "/cv-rewrite/accept"],
    ["patch", `/documents/${UNKNOWN}/parent`]
  ] as const)("%s %s: user only", async (m, p) => {
    await call(m, p).expect(401);
    await call(m, p, guestCookie).expect(401);
    expect((await call(m, p, userCookie)).status).not.toBe(401);
  });

  it("POST /documents by an anonymous caller creates a guest and sets mcv_session", async () => {
    const res = await call("post", "/documents")
      .send({
        kind: "JD",
        sourceText: "Senior Frontend Engineer — React, TypeScript",
        save: false
      })
      .expect(201);
    const owner = await ctx.prisma.document.findUnique({
      where: { id: (res.body as { id: string }).id },
      include: { user: true }
    });
    if (owner) users.push(owner.userId);
    const setCookie = String(res.headers["set-cookie"]);
    expect(setCookie).toMatch(/mcv_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(owner?.user.isGuest).toBe(true);
    const newCookie = /mcv_session=[^;]+/.exec(setCookie)![0];
    await call("get", "/documents", newCookie).expect(401);
  });

  it.each([
    ["guest", () => guestCookie, () => guestId],
    ["signed-in user", () => userCookie, () => userId]
  ] as const)(
    "POST /documents as %s passes the guard and creates no new guest",
    async (_who, cookie, id) => {
      const res = await call("post", "/documents", cookie())
        .send({
          kind: "JD",
          sourceText: "Senior Frontend Engineer — React, TypeScript",
          save: false
        })
        .expect(201);
      const doc = await ctx.prisma.document.findUnique({
        where: { id: (res.body as { id: string }).id }
      });
      expect(doc?.userId).toBe(id());
      expect(String(res.headers["set-cookie"] ?? "")).not.toMatch(
        /mcv_session=[^;]+/
      );
    }
  );

  it("a 401 body carries code SIGN_IN_REQUIRED", async () => {
    const res = await call("get", "/documents").expect(401);
    expect((res.body as { code: string }).code).toBe("SIGN_IN_REQUIRED");
  });
});
