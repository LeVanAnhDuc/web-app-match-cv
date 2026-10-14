import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import { serverMessage } from "@/data/copy";
import { API_BULLET, API_REWORDED } from "@/data/test-data/cv-rewrite-assistant";

// Who may call the rewrite endpoints (REQ-04, REQ-05). Every case is decided before the provider call: the auth guard
// runs first, then requireOwnedMatch, then credential resolution — so no request here can reach a paid model.

const acceptBody = (matchResultId: string) => ({
  matchResultId,
  title: "Improved CV",
  changes: [{ original: API_BULLET, replacement: API_REWORDED }],
});

test.describe("cv rewrite — access", () => {
  test(
    "người chưa đăng nhập bị từ chối ở cả sinh lẫn lưu",
    { tag: ["@TC-CVREWRITEASSISTANT-001", "@smoke"] },
    async ({ anonApi }) => {
      const generate = await anonApi.cvRewrite.generate({ matchResultId: randomUUID() });
      expect(generate.status).toBe(401);
      expect(generate.error()).toMatchObject({ code: "SIGN_IN_REQUIRED", message: serverMessage("auth.errors.signInRequired") });

      const accept = await anonApi.cvRewrite.accept(acceptBody(randomUUID()));
      expect(accept.status).toBe(401);
      expect(accept.error()).toMatchObject({ code: "SIGN_IN_REQUIRED", message: serverMessage("auth.errors.signInRequired") });
    }
  );

  test(
    "phiên khách bị từ chối ở cả sinh lẫn lưu",
    { tag: ["@TC-CVREWRITEASSISTANT-002", "@smoke", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const guest = await rewriteUsers.guest();
      const seed = await rewriteData.match({ userId: guest.userId });

      const generate = await guest.api.cvRewrite.generate({ matchResultId: seed.matchId });
      expect(generate.status).toBe(401);
      expect(generate.error().code).toBe("SIGN_IN_REQUIRED");

      const accept = await guest.api.cvRewrite.accept(acceptBody(seed.matchId));
      expect(accept.status).toBe(401);
      expect(accept.error().code).toBe("SIGN_IN_REQUIRED");
      expect(await rewriteData.childrenOf(seed.cvId)).toHaveLength(0);
    }
  );

  test(
    "không sinh được đề xuất trên match của người khác",
    { tag: ["@TC-CVREWRITEASSISTANT-003", "@smoke", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const owner = await rewriteUsers.signedIn();
      const intruder = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: owner.userId });

      const res = await intruder.api.cvRewrite.generate({ matchResultId: seed.matchId });

      expect(res.status).toBe(404);
      expect(res.error().message).toBe(serverMessage("cvRewrite.errors.matchNotFound"));
    }
  );

  test(
    "không lưu được bản viết lại từ match của người khác",
    { tag: ["@TC-CVREWRITEASSISTANT-004", "@smoke", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const owner = await rewriteUsers.signedIn();
      const intruder = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: owner.userId });

      const res = await intruder.api.cvRewrite.accept(acceptBody(seed.matchId));

      expect(res.status).toBe(404);
      expect(res.error().message).toBe(serverMessage("cvRewrite.errors.matchNotFound"));
      expect(await rewriteData.childrenOf(seed.cvId)).toHaveLength(0);
      const intruderDocs = await intruder.api.documents.list();
      expect(intruderDocs.status).toBe(200);
      expect(intruderDocs.json()).toHaveLength(0);
    }
  );

  test(
    "credential của người khác hoặc không tồn tại bị từ chối trước khi gọi AI",
    { tag: ["@TC-CVREWRITEASSISTANT-005", "@smoke", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const other = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId });
      const foreign = await rewriteData.credential({ userId: other.userId });

      for (const credentialId of [foreign.id, randomUUID()]) {
        const res = await me.api.cvRewrite.generate({ matchResultId: seed.matchId, credentialId });
        expect(res.status, `credentialId ${credentialId}`).toBe(404);
        expect(res.error().message).toBe(serverMessage("aiCredentials.errors.notFound"));
      }
    }
  );
});
