import { execSync } from "child_process";
import { Test } from "@nestjs/testing";
import { CurrentUserModule } from "../src/common/current-user/current-user.module";
import {
  CurrentUserService,
  STUB_USER_ID
} from "../src/common/current-user/current-user.service";
import { PrismaModule } from "../src/prisma/prisma.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("CurrentUser stub + seed (e2e)", () => {
  let prisma: PrismaService;
  let currentUserService: CurrentUserService;

  beforeAll(async () => {
    execSync("npx prisma db seed", { cwd: process.cwd(), stdio: "inherit" });

    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, CurrentUserModule]
    }).compile();
    prisma = moduleRef.get(PrismaService);
    currentUserService = moduleRef.get(CurrentUserService);
    await prisma.$connect();
  }, 60000);

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seed creates/keeps the stub user (idempotent, count >= 1)", async () => {
    const count = await prisma.user.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("stub user exists with fixed id and candidate role", async () => {
    const user = await prisma.user.findUnique({ where: { id: STUB_USER_ID } });
    expect(user).not.toBeNull();
    expect(user?.role).toBe("candidate");
  });

  it("CurrentUserService.getUserId() returns the stub user id", () => {
    expect(currentUserService.getUserId()).toBe(STUB_USER_ID);
  });
});
