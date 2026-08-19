import { BadRequestException, NotFoundException } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import type { CurrentUserService } from "../../common/current-user/current-user.service";
import type { PrismaService } from "../../prisma/prisma.service";

const USER_ID = "user-1";

function doc(over: Record<string, unknown> = {}) {
  return {
    id: "cv-v2",
    userId: USER_ID,
    kind: "CV",
    title: "Backend Resume (improved)",
    sourceFormat: "text",
    rawText: "…",
    parsedContent: null,
    fileData: null,
    fileMime: null,
    isSaved: true,
    parentId: null,
    createdAt: new Date("2026-08-09T00:00:00.000Z"),
    ...over
  };
}

function build(documents: Array<ReturnType<typeof doc>>) {
  const update = jest.fn(
    ({ where, data }: { where: { id: string }; data: { parentId: unknown } }) =>
      Promise.resolve({
        ...documents.find((entry) => entry.id === where.id),
        parentId: data.parentId
      })
  );
  const prisma = {
    document: {
      findFirst: jest.fn(
        ({ where }: { where: { id: string; userId: string } }) =>
          Promise.resolve(
            documents.find(
              (entry) => entry.id === where.id && entry.userId === where.userId
            ) ?? null
          )
      ),
      update
    }
  } as unknown as PrismaService;
  const currentUser: CurrentUserService = {
    getUserId: () => USER_ID
  };
  return { service: new DocumentsService(prisma, currentUser), update };
}

// Lineage is the manual half of Goal 9 — the only way a hand-edited CV gets the
// link the rewrite assistant creates automatically.
describe("DocumentsService.setParent", () => {
  it("links a document to an earlier version of itself", async () => {
    const { service, update } = build([
      doc(),
      doc({ id: "cv-v1", title: "Backend Resume" })
    ]);

    const result = await service.setParent("cv-v2", { parentId: "cv-v1" });

    expect(update).toHaveBeenCalledWith({
      where: { id: "cv-v2" },
      data: { parentId: "cv-v1" }
    });
    expect(result.parentId).toBe("cv-v1");
  });

  it("clears the link, which is how a wrong one is undone", async () => {
    const { service, update } = build([doc({ parentId: "cv-v1" })]);

    await service.setParent("cv-v2", { parentId: null });

    expect(update).toHaveBeenCalledWith({
      where: { id: "cv-v2" },
      data: { parentId: null }
    });
  });

  it("404s on a document that is not the caller's", async () => {
    const { service } = build([doc({ userId: "someone-else" })]);

    await expect(
      service.setParent("cv-v2", { parentId: null })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects a document pointed at itself", async () => {
    const { service, update } = build([doc()]);

    await expect(
      service.setParent("cv-v2", { parentId: "cv-v2" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  // 400 rather than 404, and the same message either way, so another user's
  // document is indistinguishable from one that does not exist.
  it("rejects a parent that belongs to someone else", async () => {
    const { service } = build([
      doc(),
      doc({ id: "cv-v1", userId: "someone-else" })
    ]);

    await expect(
      service.setParent("cv-v2", { parentId: "cv-v1" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects a parent of the other kind", async () => {
    const { service } = build([doc(), doc({ id: "jd-1", kind: "JD" })]);

    await expect(
      service.setParent("cv-v2", { parentId: "jd-1" })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  // Regression for the security review's M1. A chain longer than the walk cap
  // is indistinguishable from one that ended at a root, so "no cycle found"
  // would only be a statement about how far we looked. Build 25 links and the
  // guard has to refuse rather than guess.
  it("refuses to extend a chain longer than it can verify", async () => {
    const chain = Array.from({ length: 25 }, (_, index) =>
      doc({
        id: `cv-${index}`,
        parentId: index === 24 ? null : `cv-${index + 1}`
      })
    );
    const { service, update } = build(chain);

    await expect(
      service.setParent("cv-0", { parentId: "cv-1" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it("still accepts a chain it can walk to the end", async () => {
    const chain = Array.from({ length: 5 }, (_, index) =>
      doc({
        id: `cv-${index}`,
        parentId: index === 4 ? null : `cv-${index + 1}`
      })
    );
    const { service, update } = build([
      ...chain,
      doc({ id: "fresh", parentId: null })
    ]);

    await service.setParent("fresh", { parentId: "cv-0" });

    expect(update).toHaveBeenCalledWith({
      where: { id: "fresh" },
      data: { parentId: "cv-0" }
    });
  });

  // A cycle makes the version walk and every ancestor query non-terminating.
  it("rejects a link that would close a loop", async () => {
    const { service, update } = build([
      doc({ id: "cv-v1", parentId: null }),
      doc({ id: "cv-v2", parentId: "cv-v1" })
    ]);

    await expect(
      service.setParent("cv-v1", { parentId: "cv-v2" })
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });
});
