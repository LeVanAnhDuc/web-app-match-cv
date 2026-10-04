import { SessionService } from "./session.service";

const prisma = {
  session: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn()
  }
};
const service = new SessionService(
  prisma as never,
  { get: () => undefined } as never
);

describe("SessionService", () => {
  beforeEach(() => jest.resetAllMocks());

  it("stores only the hash of the token", async () => {
    const token = await service.create("u-1", new Date(Date.now() + 1000));
    const call = prisma.session.create.mock.calls[0] as [
      { data: { id: string } }
    ];
    const stored = call[0].data.id;
    expect(stored).toBe(SessionService.hash(token));
    expect(stored).not.toContain(token);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });

  it("resolves a live session to its user", async () => {
    prisma.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "u-1", isGuest: false }
    });
    await expect(service.resolve("tok")).resolves.toEqual({
      userId: "u-1",
      isGuest: false
    });
  });

  it("drops an expired session and resolves to null", async () => {
    prisma.session.findUnique.mockResolvedValue({
      expiresAt: new Date(Date.now() - 1),
      user: { id: "u-1", isGuest: false }
    });
    await expect(service.resolve("tok")).resolves.toBeNull();
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { id: SessionService.hash("tok") }
    });
  });

  it("resolves an unknown token to null", async () => {
    prisma.session.findUnique.mockResolvedValue(null);
    await expect(service.resolve("tok")).resolves.toBeNull();
  });
});
