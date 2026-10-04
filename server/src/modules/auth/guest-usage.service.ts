import { createHmac } from "crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";

export interface GuestQuota {
  limit: number;
  used: number;
  resetsAt: Date;
}

export const utcDay = (now: Date): string => now.toISOString().slice(0, 10);

export function nextUtcMidnight(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
  );
}

/** NFR-COST-04 — per-IP daily cap on system-key matches for guests. The IP is stored only as an HMAC. */
@Injectable()
export class GuestUsageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  private limit(): number {
    return this.config.get<number>("GUEST_MATCH_LIMIT_PER_DAY") ?? 5;
  }

  private hash(ip: string): string {
    const secret = this.config.get<string>("SESSION_SECRET");
    if (!secret) {
      throw new ServiceUnavailableException({ code: "AUTH_NOT_CONFIGURED" });
    }
    return createHmac("sha256", secret).update(ip).digest("hex");
  }

  async peek(ip: string): Promise<GuestQuota> {
    const now = new Date();
    const row = await this.prisma.guestUsage.findUnique({
      where: {
        ipHash_day: {
          ipHash: this.hash(ip),
          day: new Date(`${utcDay(now)}T00:00:00Z`)
        }
      }
    });
    return {
      limit: this.limit(),
      used: row?.count ?? 0,
      resetsAt: nextUtcMidnight(now)
    };
  }

  /** Atomic check-and-increment, BEFORE the AI call: the money is spent when we call, not when it succeeds. */
  async consume(ip: string): Promise<GuestQuota & { allowed: boolean }> {
    const now = new Date();
    const limit = this.limit();
    const resetsAt = nextUtcMidnight(now);
    // The INSERT path would admit one row even at limit 0.
    if (limit <= 0) return { allowed: false, used: 0, limit, resetsAt };
    const rows = await this.prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO "GuestUsage" ("ipHash", "day", "count")
      VALUES (${this.hash(ip)}, ${utcDay(now)}::date, 1)
      ON CONFLICT ("ipHash", "day") DO UPDATE SET "count" = "GuestUsage"."count" + 1
      WHERE "GuestUsage"."count" < ${limit}
      RETURNING "count"`;
    return rows.length
      ? { allowed: true, used: Number(rows[0].count), limit, resetsAt }
      : { allowed: false, used: limit, limit, resetsAt };
  }
}
