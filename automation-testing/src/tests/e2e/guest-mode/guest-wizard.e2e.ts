import { test, expect } from "@/fixtures";
import {
  GUEST_CV_TEXT,
  GUEST_JD_TEXT,
  quotaExceededBody,
  resetsInTime,
  systemKeyResult,
} from "@/data/test-data/guest-mode";

// REQ-GUESTMODE-18…21: the wizard as a guest. D1: POST /match (the only AI call of the flow) is stubbed with
// `network`; documents, runs and GET /auth/me hit the real backend. The one real 429 (TC-042) is reached by planting
// the per-IP counter, so the server refuses before any provider call.

const MATCH = "**/api/v1/match";
const ME = "**/api/v1/auth/me";
const signInHref = (apiUrl: string, returnTo: string) => `${apiUrl}/auth/login?returnTo=${encodeURIComponent(returnTo)}`;

test.describe("guest wizard", () => {
  test.beforeEach(async ({ guestModeQuota }) => {
    await guestModeQuota.clear();
  });

  test.afterEach(async ({ guestModeBrowser }) => {
    await guestModeBrowser.adoptGuest();
  });

  test(
    "Bước 1–2 của khách chỉ có Upload/Paste kèm ghi chú giữ 24 giờ, không có lưu hay tài liệu đã lưu",
    { tag: ["@TC-GUESTMODE-039", "@smoke"] },
    async ({ guestModeWizardPage: wizard, urls }) => {
      await wizard.goto();

      for (const kind of ["jd", "cv"] as const) {
        await expect(wizard.inputModes()).toHaveCount(2);
        await expect(wizard.inputMode("upload")).toBeAttached();
        await expect(wizard.inputMode("paste")).toBeAttached();
        await expect(wizard.guestNote()).toBeVisible();
        await expect(wizard.guestNoteSignInLink()).toHaveAttribute("href", signInHref(urls.apiUrl, "/wizard"));
        await expect(wizard.savedListHeading(kind)).toHaveCount(0);

        await wizard.paste(kind === "jd" ? GUEST_JD_TEXT : GUEST_CV_TEXT);
        await expect(wizard.saveForReuseButton()).toHaveCount(0);
        if (kind === "jd") {
          await wizard.submitDocument();
          await expect(wizard.stepHeading("wizard.stepCv.title")).toBeVisible();
        }
      }
    }
  );

  test(
    "Nhóm tab Upload/Paste cách vùng thả file ít nhất 16px",
    { tag: ["@TC-GUESTMODE-040"] },
    async ({ guestModeWizardPage: wizard }) => {
      await wizard.goto();
      // Polled: the first measurement can land before the Segmented / Dragger settle after hydration.
      await expect
        .poll(async () => {
          const tabs = await wizard.inputModeGroup().boundingBox();
          const zone = await wizard.dropZone().boundingBox();
          return tabs && zone ? zone.y - (tabs.y + tabs.height) : -Infinity;
        })
        .toBeGreaterThanOrEqual(16);
    }
  );

  test(
    "Khách chạy match một lần trên key hệ thống và thấy kết quả giữ 24 giờ",
    { tag: ["@TC-GUESTMODE-041", "@smoke"] },
    async ({ guestModeWizardPage: wizard, network, urls }) => {
      await network.stubJson(MATCH, systemKeyResult(), { method: "POST", status: 201 });
      await wizard.goto();
      await wizard.pasteJdAndCv(GUEST_JD_TEXT, GUEST_CV_TEXT);

      await expect(wizard.runMatchButton()).toBeEnabled();
      await expect(wizard.runWithSelector()).toHaveCount(0);
      await expect(wizard.runMatchCountButton()).toHaveCount(0);
      const run = await wizard.runMatch();
      const runId = ((await run.json()) as { id: string }).id;

      await expect(wizard.systemKeyCardTitle()).toBeVisible();
      await expect(wizard.overallMeter()).toBeVisible();
      await expect(wizard.improveCvButton()).toHaveCount(0);
      await expect(wizard.coverLetterButton()).toHaveCount(0);
      await expect(wizard.keepTitle()).toBeVisible();
      await expect(wizard.keepBody()).toBeVisible();
      await expect(wizard.keepSignInLink()).toHaveAttribute(
        "href",
        signInHref(urls.apiUrl, `/wizard?runId=${encodeURIComponent(runId)}`)
      );
      await expect(wizard.actionBarButtons()).toHaveCount(1);
      await expect(wizard.startOverButton()).toBeVisible();
    }
  );

  test(
    "Hết lượt thật hiện thẻ quota với đếm ngược, đăng nhập, về trang chủ và sidebar còn 0 lượt",
    { tag: ["@TC-GUESTMODE-042", "@smoke"] },
    async ({ guestModeWizardPage: wizard, anonApi, guestModeQuota, shell }) => {
      const { limit } = (await anonApi.auth.me()).json().guestQuota!;
      await guestModeQuota.plant(limit);
      // Safety: unless the server already counts the quota as spent, the real POST /match would reach the AI.
      expect((await anonApi.auth.me()).json().guestQuota!.used, "quota not spent: refusing to run a real match").toBe(
        limit
      );

      await wizard.goto();
      await wizard.pasteJdAndCv(GUEST_JD_TEXT, GUEST_CV_TEXT);
      const refused = wizard.page.waitForResponse((r) => r.url().endsWith("/api/v1/match") && r.request().method() === "POST");
      await wizard.runMatch();
      expect((await refused).status()).toBe(429);

      await expect(wizard.gate.quotaTitle(limit)).toBeVisible();
      await expect(wizard.gate.quotaDescription()).toBeVisible();
      await expect(wizard.gate.resetsIn()).toBeVisible();
      await expect(wizard.gate.signInLink()).toBeVisible();
      await expect(wizard.gate.backHomeLink()).toBeVisible();
      await expect(wizard.keepTitle()).toHaveCount(0);

      if (await shell.isCompact()) await shell.openDrawer();
      await expect(shell.guestQuotaText(0, limit)).toBeVisible();
    }
  );

  test(
    "Thẻ quota đếm ngược tới resetsAt và tải lại quota sau 429",
    { tag: ["@TC-GUESTMODE-043"] },
    async ({ guestModeWizardPage: wizard, network }) => {
      const resetsAt = new Date(Date.now() + 150 * 60_000 - 1_000);
      await network.stubJson(MATCH, quotaExceededBody(3, resetsAt), { method: "POST", status: 429 });
      const meCalls = network.recordRequests(ME, { method: "GET" });

      await wizard.goto();
      await wizard.pasteJdAndCv(GUEST_JD_TEXT, GUEST_CV_TEXT);
      const before = meCalls.length;
      await wizard.runMatch();

      await expect(wizard.gate.quotaTitle(3)).toBeVisible();
      await expect(wizard.gate.resetsIn(resetsInTime(resetsAt))).toBeVisible();
      await expect.poll(() => meCalls.length).toBeGreaterThan(before);
    }
  );

  test(
    "Quota được tải lại sau một lần match thành công",
    { tag: ["@TC-GUESTMODE-044"] },
    async ({ guestModeWizardPage: wizard, network }) => {
      await network.stubJson(MATCH, systemKeyResult(), { method: "POST", status: 201 });
      const meCalls = network.recordRequests(ME, { method: "GET" });

      await wizard.goto();
      await wizard.pasteJdAndCv(GUEST_JD_TEXT, GUEST_CV_TEXT);
      const before = meCalls.length;
      await wizard.runMatch();

      await expect(wizard.systemKeyCardTitle()).toBeVisible();
      await expect.poll(() => meCalls.length).toBeGreaterThan(before);
    }
  );
});
