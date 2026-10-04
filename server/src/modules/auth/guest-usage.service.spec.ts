import { ServiceUnavailableException } from "@nestjs/common";
import {
  GuestUsageService,
  nextUtcMidnight,
  utcDay
} from "./guest-usage.service";

function make(env: Record<string, unknown>) {
  const prisma = {
    $queryRaw: jest.fn(),
    guestUsage: { findUnique: jest.fn() }
  };
  const config = { get: (k: string) => env[k] };
  const service = new GuestUsageService(prisma as never, config as never);
  return { service, prisma };
}

describe("UTC helpers", () => {
  it("utcDay formats the UTC calendar day", () => {
    expect(utcDay(new Date("2026-10-04T23:59:59Z"))).toBe("2026-10-04");
  });

  it("nextUtcMidnight is the following 00:00Z", () => {
    expect(
      nextUtcMidnight(new Date("2026-10-04T23:59:59Z")).toISOString()
    ).toBe("2026-10-05T00:00:00.000Z");
  });
});

describe("GuestUsageService", () => {
  const env = { SESSION_SECRET: "s".repeat(32), GUEST_MATCH_LIMIT_PER_DAY: 5 };

  it("allows and reports usage when the upsert returns a row", async () => {
    const { service, prisma } = make(env);
    prisma.$queryRaw.mockResolvedValue([{ count: 3 }]);
    const q = await service.consume("1.2.3.4");
    expect(q).toMatchObject({ allowed: true, used: 3, limit: 5 });
  });

  it("denies when the upsert returns no row (cap reached)", async () => {
    const { service, prisma } = make(env);
    prisma.$queryRaw.mockResolvedValue([]);
    const q = await service.consume("1.2.3.4");
    expect(q).toMatchObject({ allowed: false, used: 5, limit: 5 });
  });

  it("never binds the raw IP: a 64-hex HMAC is passed instead", async () => {
    const { service, prisma } = make(env);
    prisma.$queryRaw.mockResolvedValue([{ count: 1 }]);
    await service.consume("1.2.3.4");
    const values = (prisma.$queryRaw.mock.calls[0] as unknown[]).slice(1);
    expect(values).not.toContain("1.2.3.4");
    expect(
      values.some((v) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v))
    ).toBe(true);
  });

  it("denies without querying when the limit is 0", async () => {
    const { service, prisma } = make({ ...env, GUEST_MATCH_LIMIT_PER_DAY: 0 });
    const q = await service.consume("1.2.3.4");
    expect(q.allowed).toBe(false);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("throws 503 when SESSION_SECRET is missing", async () => {
    const { service } = make({});
    await expect(service.consume("1.2.3.4")).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it("peek reads today's row", async () => {
    const { service, prisma } = make(env);
    prisma.guestUsage.findUnique.mockResolvedValue({ count: 2 });
    expect(await service.peek("1.2.3.4")).toMatchObject({ used: 2, limit: 5 });
  });
});
