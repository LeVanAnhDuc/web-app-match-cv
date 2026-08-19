import { Test } from "@nestjs/testing";
import { PrismaModule } from "../src/prisma/prisma.module";
import { PrismaService } from "../src/prisma/prisma.service";

describe("Prisma (e2e)", () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule]
    }).compile();
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("connects and runs a raw query", async () => {
    const result = await prisma.$queryRaw`SELECT 1 as ok`;
    expect(result).toEqual([{ ok: 1 }]);
  });

  it("User table is queryable", async () => {
    const count = await prisma.user.count();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
