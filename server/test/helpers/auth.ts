import { createHash, randomBytes } from "crypto";
import { Role } from "@prisma/client";
import { PrismaService } from "../../src/prisma/prisma.service";

const DAY_MS = 86_400_000;

async function sessionFor(
  prisma: PrismaService,
  userId: string,
  expiresAt: Date
): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: {
      id: createHash("sha256").update(token).digest("hex"),
      userId,
      expiresAt
    }
  });
  return `mcv_session=${token}`;
}

export async function createSignedInUser(
  prisma: PrismaService,
  opts: { email?: string } = {}
): Promise<{ userId: string; cookie: string }> {
  const user = await prisma.user.create({
    data: {
      role: Role.candidate,
      externalSub: randomBytes(12).toString("hex"),
      email: opts.email ?? `e2e-${randomBytes(4).toString("hex")}@test.local`
    }
  });
  return {
    userId: user.id,
    cookie: await sessionFor(prisma, user.id, new Date(Date.now() + DAY_MS))
  };
}

export async function createGuestUser(
  prisma: PrismaService
): Promise<{ userId: string; cookie: string }> {
  const expiresAt = new Date(Date.now() + DAY_MS);
  const user = await prisma.user.create({
    data: { role: Role.candidate, isGuest: true, guestExpiresAt: expiresAt }
  });
  return {
    userId: user.id,
    cookie: await sessionFor(prisma, user.id, expiresAt)
  };
}

export async function deleteUsers(
  prisma: PrismaService,
  ids: string[]
): Promise<void> {
  if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
