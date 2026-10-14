import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import {
  API_REWORDED,
  GAP_CICD,
  MATCH_GONE,
  PROVIDER_FAILURE,
  REWRITE_ROUTES,
  proposal,
} from "@/data/test-data/cv-rewrite-assistant";

// The rewrite page before review: what it shows, which key it runs on, and how generation succeeds or fails
// (REQ-06…11, 14, 31). POST /cv-rewrite is the only stubbed request (D1); match, document, credentials and providers
// come from the real backend, seeded per test.

const GENERATE = { method: "POST", status: 201 } as const;

test.describe("cv rewrite — page and generation", () => {
  test(
    "trang hiện CV và gaps, chưa sinh gì trước khi bấm",
    { tag: ["@TC-CVREWRITEASSISTANT-037", "@smoke", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      const posts = network.recordRequests(REWRITE_ROUTES.generate, { method: "POST" });
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);

      await rewritePage.open(seed.matchId);

      await expect(rewritePage.heading()).toBeVisible();
      await expect(rewritePage.subtitle()).toBeVisible();
      await expect(rewritePage.setupHeading(seed.cvTitle)).toBeVisible();
      await expect(rewritePage.gapsTitle()).toBeVisible();
      await expect(rewritePage.gap(GAP_CICD)).toBeVisible();
      await expect(rewritePage.changesHeading()).toHaveCount(0);
      expect(posts).toHaveLength(0);

      await rewritePage.generateProposal();
      expect(posts).toHaveLength(1);
    }
  );

  test(
    "tiêu đề setup không lộ placeholder khi CV chưa tải xong",
    { tag: ["@TC-CVREWRITEASSISTANT-038", "@creates-data"] },
    async ({ rewriteData, rewritePage, rewriteRoutes }) => {
      const seed = await rewriteData.match();
      await rewriteRoutes.slowDown(REWRITE_ROUTES.documentById, 3_000, { method: "GET" });

      await rewritePage.open(seed.matchId);

      await expect(rewritePage.setupHeadingFallback()).toBeVisible();
      await expect(rewritePage.rawPlaceholder()).toHaveCount(0);
      await expect(rewritePage.setupHeading(seed.cvTitle)).toBeVisible({ timeout: 10_000 });
      await expect(rewritePage.rawPlaceholder()).toHaveCount(0);
    }
  );

  test(
    "match chạy bằng key hệ thống: mặc định System key và không gửi credentialId",
    { tag: ["@TC-CVREWRITEASSISTANT-039", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match({ credentialId: null });
      const posts = network.recordRequests(REWRITE_ROUTES.generate, { method: "POST" });
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);

      await rewritePage.open(seed.matchId);

      await expect(rewritePage.runWith.select()).toBeVisible();
      await expect(rewritePage.runWith.systemKeyChoice()).toBeVisible();
      await expect(rewritePage.runWith.privacySystem()).toBeVisible();
      await expect(rewritePage.runWith.untestedTag()).toHaveCount(0);

      await rewritePage.generateProposal();
      expect(posts).toHaveLength(1);
      expect(posts[0].body).toEqual({ matchResultId: seed.matchId });
    }
  );

  test(
    "match chạy bằng credential riêng: chọn sẵn, che key, cảnh báo chưa test",
    { tag: ["@TC-CVREWRITEASSISTANT-040", "@creates-data"] },
    async ({ rewriteData, rewritePage, network, api, page }) => {
      const credential = await rewriteData.credential({ lastTestStatus: null });
      const seed = await rewriteData.match({ credentialId: credential.id });
      const providers = await api.aiCredentials.providers();
      expect(providers.status).toBe(200);
      const provider = providers.json().find((p) => p.id === credential.provider)!.label;
      const posts = network.recordRequests(REWRITE_ROUTES.generate, { method: "POST" });
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);

      await rewritePage.open(seed.matchId);

      await expect(rewritePage.runWith.choice(`${provider} · ${credential.label} · ••••${credential.keyLast4}`)).toBeVisible();
      await expect(rewritePage.runWith.untestedTag()).toBeVisible();
      await expect(rewritePage.runWith.privacyFor(provider)).toBeVisible();
      await expect(rewritePage.runWith.privacySystem()).toHaveCount(0);
      expect(await page.content()).not.toContain("not-a-real-ciphertext");

      await rewritePage.generateProposal();
      expect(posts[0].body).toEqual({ matchResultId: seed.matchId, credentialId: credential.id });
    }
  );

  test(
    "credential đã test không bị cảnh báo, chuyển sang key hệ thống đổi thông báo",
    { tag: ["@TC-CVREWRITEASSISTANT-041", "@creates-data"] },
    async ({ rewriteData, rewritePage, network, api }) => {
      const credential = await rewriteData.credential({ lastTestStatus: "ok" });
      const seed = await rewriteData.match({ credentialId: credential.id });
      const provider = (await api.aiCredentials.providers()).json().find((p) => p.id === credential.provider)!.label;
      const posts = network.recordRequests(REWRITE_ROUTES.generate, { method: "POST" });
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), GENERATE);

      await rewritePage.open(seed.matchId);
      await expect(rewritePage.runWith.privacyFor(provider)).toBeVisible();
      await expect(rewritePage.runWith.untestedTag()).toHaveCount(0);

      await rewritePage.runWith.pickSystemKey();
      await expect(rewritePage.runWith.privacySystem()).toBeVisible();
      await expect(rewritePage.runWith.privacyFor(provider)).toHaveCount(0);

      await rewritePage.generateProposal();
      expect(posts[0].body).toEqual({ matchResultId: seed.matchId });
    }
  );

  test(
    "đang sinh thì bấm thêm không gửi request thứ hai",
    { tag: ["@TC-CVREWRITEASSISTANT-042", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      const posts = network.recordRequests(REWRITE_ROUTES.generate, { method: "POST" });
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), { ...GENERATE, delayMs: 2_000 });
      await rewritePage.open(seed.matchId);

      await rewritePage.generateButton().click();
      await rewritePage.clickGenerateWhileBusy();

      await expect(rewritePage.changesHeading()).toBeVisible({ timeout: 10_000 });
      expect(posts).toHaveLength(1);
    }
  );

  test(
    "vùng chờ khi đang sinh được đánh dấu aria-busy trong vùng aria-live",
    { tag: ["@TC-CVREWRITEASSISTANT-043", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      // BUG: defects/cv-rewrite-assistant.md#bug-cvrewriteassistant-04
      test.fail();
      const seed = await rewriteData.match();
      await network.stubJson(REWRITE_ROUTES.generate, proposal(seed), { ...GENERATE, delayMs: 3_000 });
      await rewritePage.open(seed.matchId);

      await rewritePage.generateButton().click();

      await expect(rewritePage.busyIndicator()).toBeVisible();
    }
  );

  test(
    "provider lỗi được báo và đề xuất cũ vẫn còn",
    { tag: ["@TC-CVREWRITEASSISTANT-044", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      // Routes run newest-first: the one-off success answers the first press, the 503 every later one.
      await network.failWith(REWRITE_ROUTES.generate, 503, { method: "POST", body: PROVIDER_FAILURE });
      await network.stubOnce(REWRITE_ROUTES.generate, proposal(seed), GENERATE);
      await rewritePage.open(seed.matchId);
      await rewritePage.generateProposal();
      await expect(rewritePage.change(0).text(API_REWORDED)).toBeVisible();

      await rewritePage.generate();

      await expect(rewritePage.message("rewrite.err.generateFailed")).toBeVisible();
      await expect(rewritePage.change(0).text(API_REWORDED)).toBeVisible();
      await expect(rewritePage.changeGroups()).toHaveCount(2);
      await expect(rewritePage.regenerateButton()).toBeEnabled();
    }
  );

  test(
    "match bị xoá ở tab khác được báo rõ khi sinh",
    { tag: ["@TC-CVREWRITEASSISTANT-045", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      await network.failWith(REWRITE_ROUTES.generate, 404, { method: "POST", body: MATCH_GONE });
      await rewritePage.open(seed.matchId);

      await rewritePage.generate();

      await expect(rewritePage.message("rewrite.err.matchNotFound")).toBeVisible();
    }
  );

  test(
    "match không tồn tại hiện lỗi thay vì trang trắng",
    { tag: ["@TC-CVREWRITEASSISTANT-046"] },
    async ({ rewritePage }) => {
      await rewritePage.goto(randomUUID());

      // TanStack Query retries a failed read with backoff before giving up, so the error is a few seconds out.
      await expect(rewritePage.loadError("rewrite.err.matchNotFound")).toBeVisible({ timeout: 20_000 });
      await expect(rewritePage.heading()).toBeVisible();
      await expect(rewritePage.generateButton()).toHaveCount(0);
    }
  );

  test(
    "lỗi khác khi tải match hiện thông báo chung",
    { tag: ["@TC-CVREWRITEASSISTANT-047", "@creates-data"] },
    async ({ rewriteData, rewritePage, network }) => {
      const seed = await rewriteData.match();
      await network.failWith(REWRITE_ROUTES.matchById, 500, { method: "GET" });

      await rewritePage.goto(seed.matchId);

      await expect(rewritePage.loadError("err.matchFailed")).toBeVisible({ timeout: 20_000 });
      await expect(rewritePage.generateButton()).toHaveCount(0);
    }
  );
});
