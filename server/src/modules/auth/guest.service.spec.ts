import { GuestService } from "./guest.service";

const tx = {
  user: { findUnique: jest.fn(), deleteMany: jest.fn() },
  document: { updateMany: jest.fn() },
  matchRun: { updateMany: jest.fn() },
  matchResult: { updateMany: jest.fn() }
};
const prisma = {
  user: { create: jest.fn(), deleteMany: jest.fn() },
  guestUsage: { deleteMany: jest.fn() },
  $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx))
};
const sessions = { create: jest.fn().mockResolvedValue("raw-token") };
const config = {
  get: (k: string) => (k === "GUEST_TTL_HOURS" ? 24 : undefined)
};
const service = new GuestService(
  prisma as never,
  sessions as never,
  config as never
);

describe("GuestService", () => {
  beforeEach(() => jest.clearAllMocks());

  it("purges expired guests before creating one, then opens a session of the same lifetime", async () => {
    prisma.user.deleteMany.mockResolvedValue({ count: 2 });
    prisma.user.create.mockResolvedValue({ id: "g-1" });
    const guest = await service.create();
    expect(prisma.user.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.user.create.mock.invocationCallOrder[0]
    );
    const data = (
      prisma.user.create.mock.calls[0] as [
        { data: { isGuest: boolean; guestExpiresAt: Date } }
      ]
    )[0].data;
    expect(data.isGuest).toBe(true);
    expect(sessions.create).toHaveBeenCalledWith("g-1", data.guestExpiresAt);
    expect(guest).toEqual({
      userId: "g-1",
      token: "raw-token",
      expiresAt: data.guestExpiresAt
    });
  });

  it("moves documents, runs and results, marks documents saved, deletes the guest", async () => {
    tx.user.findUnique.mockResolvedValue({
      id: "g-1",
      isGuest: true,
      guestExpiresAt: new Date(Date.now() + 60_000)
    });
    tx.user.deleteMany.mockResolvedValue({ count: 1 });
    await expect(service.claim("g-1", "u-1")).resolves.toBe(true);
    expect(tx.document.updateMany).toHaveBeenCalledWith({
      where: { userId: "g-1" },
      data: { userId: "u-1", isSaved: true }
    });
    expect(tx.matchRun.updateMany).toHaveBeenCalledWith({
      where: { userId: "g-1" },
      data: { userId: "u-1" }
    });
    expect(tx.matchResult.updateMany).toHaveBeenCalledWith({
      where: { userId: "g-1" },
      data: { userId: "u-1" }
    });
    expect(tx.user.deleteMany).toHaveBeenCalledWith({
      where: { id: "g-1", isGuest: true }
    });
  });

  it("returns false instead of throwing when a concurrent claim already deleted the guest", async () => {
    tx.user.findUnique.mockResolvedValue({
      id: "g-1",
      isGuest: true,
      guestExpiresAt: new Date(Date.now() + 60_000)
    });
    tx.user.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.claim("g-1", "u-1")).resolves.toBe(false);
  });

  it("purgeExpired also drops GuestUsage rows older than today (UTC)", async () => {
    prisma.user.deleteMany.mockResolvedValue({ count: 0 });
    await service.purgeExpired();
    const arg = (
      prisma.guestUsage.deleteMany.mock.calls[0] as [
        { where: { day: { lt: Date } } }
      ]
    )[0];
    const lt = arg.where.day.lt;
    expect(lt.toISOString()).toBe(
      `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`
    );
  });

  it("skips an expired guest without failing", async () => {
    tx.user.findUnique.mockResolvedValue({
      id: "g-1",
      isGuest: true,
      guestExpiresAt: new Date(Date.now() - 1)
    });
    await expect(service.claim("g-1", "u-1")).resolves.toBe(false);
    expect(tx.document.updateMany).not.toHaveBeenCalled();
  });

  it("refuses to claim a non-guest", async () => {
    tx.user.findUnique.mockResolvedValue({
      id: "u-2",
      isGuest: false,
      guestExpiresAt: null
    });
    await expect(service.claim("u-2", "u-1")).resolves.toBe(false);
  });
});
