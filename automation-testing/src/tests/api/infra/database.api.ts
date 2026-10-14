import { test, expect } from "@/fixtures";
import { sql } from "@/utils/db";

// Ported from server/test/prisma.e2e-spec.ts, which booted PrismaModule alone and asserted PrismaService connects.
// Nothing about PrismaService is reachable over HTTP; the bodies below run the same checks through `pg` against the
// dev database, which proves the database, not the server's Prisma wiring.

test.describe("Prisma (e2e)", () => {
  // FIXME(migrated): needs PrismaService injected in-process; over HTTP this would only reach the dev database through pg, not the server's PrismaModule. Decide in /write-tests infra.
  test.fixme("connects and runs a raw query", async () => {
    const result = await sql("SELECT 1 as ok");
    expect(result).toEqual([{ ok: 1 }]);
  });

  // FIXME(migrated): needs PrismaService injected in-process; over HTTP this would only reach the dev database through pg, not the server's PrismaModule. Decide in /write-tests infra.
  test.fixme("User table is queryable", async () => {
    const [{ count }] = await sql<{ count: number }>('SELECT count(*)::int AS count FROM "User"');
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
