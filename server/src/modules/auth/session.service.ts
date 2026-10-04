import { createHash, randomBytes } from "crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Response } from "express";
import { PrismaService } from "../../prisma/prisma.service";

export const SESSION_COOKIE = "mcv_session";
const TOKEN_BYTES = 32;

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  static hash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  async create(userId: string, expiresAt: Date): Promise<string> {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    await this.prisma.session.create({
      data: { id: SessionService.hash(token), userId, expiresAt }
    });
    return token;
  }

  async resolve(
    token: string
  ): Promise<{ userId: string; isGuest: boolean } | null> {
    const id = SessionService.hash(token);
    const session = await this.prisma.session.findUnique({
      where: { id },
      include: { user: { select: { id: true, isGuest: true } } }
    });
    if (!session) return null;
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.session.deleteMany({ where: { id } });
      return null;
    }
    return { userId: session.user.id, isGuest: session.user.isGuest };
  }

  async revoke(token: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { id: SessionService.hash(token) }
    });
  }

  setCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.get<string>("NODE_ENV") === "production",
      path: "/",
      expires: expiresAt
    });
  }

  clearCookie(res: Response): void {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
  }
}
