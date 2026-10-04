import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SessionService } from "./session.service";

const HOUR_MS = 3_600_000;

@Injectable()
export class GuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly config: ConfigService
  ) {}

  /** Lazy cleanup (ADR-0023): guest data only grows here and at sign-in, so it is purged at those two points. */
  async purgeExpired(): Promise<number> {
    const { count } = await this.prisma.user.deleteMany({
      where: { isGuest: true, guestExpiresAt: { lt: new Date() } }
    });
    // Quota counters of past days are dead weight - keep only today's (UTC).
    const today = new Date(
      `${new Date().toISOString().slice(0, 10)}T00:00:00Z`
    );
    await this.prisma.guestUsage.deleteMany({ where: { day: { lt: today } } });
    return count;
  }

  async create(): Promise<{ userId: string; token: string; expiresAt: Date }> {
    await this.purgeExpired();
    const hours = this.config.get<number>("GUEST_TTL_HOURS") ?? 24;
    const expiresAt = new Date(Date.now() + hours * HOUR_MS);
    const user = await this.prisma.user.create({
      data: { role: Role.candidate, isGuest: true, guestExpiresAt: expiresAt }
    });
    const token = await this.sessions.create(user.id, expiresAt);
    return { userId: user.id, token, expiresAt };
  }

  /** Re-owns everything a live guest made, then deletes the guest. Returns whether anything was claimed. */
  async claim(guestUserId: string, userId: string): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const guest = await tx.user.findUnique({ where: { id: guestUserId } });
      if (
        !guest?.isGuest ||
        !guest.guestExpiresAt ||
        guest.guestExpiresAt.getTime() <= Date.now()
      ) {
        return false;
      }
      await tx.document.updateMany({
        where: { userId: guestUserId },
        data: { userId, isSaved: true }
      });
      await tx.matchRun.updateMany({
        where: { userId: guestUserId },
        data: { userId }
      });
      await tx.matchResult.updateMany({
        where: { userId: guestUserId },
        data: { userId }
      });
      // deleteMany, not delete: a concurrent double claim must not surface P2025.
      const { count } = await tx.user.deleteMany({
        where: { id: guestUserId, isGuest: true }
      });
      return count > 0;
    });
  }
}
