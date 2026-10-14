import type { AiProvider } from "#/types/AiCredentials";
import { t } from "@/data/copy";
import {
  COLLECTION_ENDPOINT,
  FAKE_KEY,
  FAKE_KEY_LAST4,
  TEST_STATUSES,
  providerInfo,
  uniqueLabel,
} from "@/data/test-data/ai-credentials";
import { expect, test } from "@/fixtures";

// The credentials page as a list (REQ-AICREDENTIALS-06 … -12). Every test runs as its own throwaway user
// (aiCredUser), so the list holds exactly what the test seeded; failures are injected only on the list GET.

test.describe("ai-credentials — list rendering", () => {
  test(
    "trang có đúng một heading cấp 1, phụ đề và ghi chú fallback nằm dưới danh sách",
    { tag: ["@TC-AICREDENTIALS-005"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      const label = uniqueLabel();
      await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });

      await aiCredentialsPage.open();

      await expect(aiCredentialsPage.rowLabel(label)).toBeVisible();
      await expect(aiCredentialsPage.level1Headings()).toHaveCount(1);
      await expect(aiCredentialsPage.heading()).toBeVisible();
      await expect(aiCredentialsPage.subtitle()).toBeVisible();
      await expect(aiCredentialsPage.fallbackNote()).toBeVisible();
      const list = (await aiCredentialsPage.list().boundingBox())!;
      const note = (await aiCredentialsPage.fallbackNote().boundingBox())!;
      expect(note.y).toBeGreaterThanOrEqual(list.y + list.height);
    }
  );

  test(
    "đang tải danh sách vẫn giữ khung trang, không trắng",
    { tag: ["@TC-AICREDENTIALS-006"] },
    async ({ aiCredUser, aiCredentialsPage, aiCredDelay }) => {
      void aiCredUser;
      await aiCredDelay(COLLECTION_ENDPOINT, 3_000, "GET");

      await aiCredentialsPage.goto();

      // While the list is in flight: the frame is there, neither the empty state nor an error.
      await expect(aiCredentialsPage.heading()).toBeVisible();
      await expect(aiCredentialsPage.subtitle()).toBeVisible();
      await expect(aiCredentialsPage.addButton()).toBeVisible();
      await expect(aiCredentialsPage.fallbackNote()).toBeVisible();
      await expect(aiCredentialsPage.emptyTitle()).toHaveCount(0);
      await expect(aiCredentialsPage.loadAlert()).toHaveCount(0);
      // …then the (empty) list lands.
      await expect(aiCredentialsPage.emptyTitle()).toBeVisible({ timeout: 15_000 });
    }
  );

  test(
    "danh sách rỗng hiện empty state, gợi ý key hệ thống và nút thêm",
    { tag: ["@TC-AICREDENTIALS-007"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      void aiCredUser;
      await aiCredentialsPage.open();

      await expect(aiCredentialsPage.emptyTitle()).toBeVisible();
      await expect(aiCredentialsPage.emptyHint()).toBeVisible();
      await expect(aiCredentialsPage.list()).toHaveCount(0);
      // The card header button plus the empty state's own call to action.
      await expect(aiCredentialsPage.addButtons()).toHaveCount(2);

      await aiCredentialsPage.addButtons().last().click();
      await expect(aiCredentialsPage.form.addDialog()).toBeVisible();
    }
  );

  test(
    "lỗi 500 khi tải danh sách hiện alert không tải được và giữ khung trang",
    { tag: ["@TC-AICREDENTIALS-008"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      void aiCredUser;
      await network.failWith(COLLECTION_ENDPOINT, 500, { method: "GET" });

      await aiCredentialsPage.goto();

      // React Query retries before giving up, hence the longer wait.
      await expect(aiCredentialsPage.loadAlert()).toHaveText(t("credentials.errors.loadFailed"), { timeout: 20_000 });
      await expect(aiCredentialsPage.heading()).toBeVisible();
      await expect(aiCredentialsPage.addButton()).toBeVisible();
      await expect(aiCredentialsPage.emptyTitle()).toHaveCount(0);
    }
  );

  test(
    "lỗi 503 khi tải danh sách nói kho credential chưa cấu hình",
    { tag: ["@TC-AICREDENTIALS-009"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      void aiCredUser;
      // What a server without CREDENTIAL_ENCRYPTION_KEY answers (decision Q4: faked in the browser).
      await network.failWith(COLLECTION_ENDPOINT, 503, { method: "GET" });

      await aiCredentialsPage.goto();

      await expect(aiCredentialsPage.loadAlert()).toHaveText(t("credentials.errors.notConfigured"), { timeout: 20_000 });
      await expect(aiCredentialsPage.loadAlert()).not.toContainText(t("credentials.errors.loadFailed"));
    }
  );

  test(
    "mỗi dòng hiện nhãn provider, tên, key che, dòng model và tag trạng thái",
    { tag: ["@TC-AICREDENTIALS-011"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      const plain = uniqueLabel("defaults");
      const overridden = uniqueLabel("overrides");
      await aiCredUser.api.aiCredentials.create({ provider: "gemini", label: plain, apiKey: FAKE_KEY });
      await aiCredUser.api.aiCredentials.create({
        provider: "openai",
        label: overridden,
        apiKey: FAKE_KEY,
        chatModel: "gpt-4o",
        embedModel: "text-embedding-3-large",
      });

      await aiCredentialsPage.open();

      for (const [label, provider, chat, embed] of [
        [plain, "gemini", null, null],
        [overridden, "openai", "gpt-4o", "text-embedding-3-large"],
      ] as Array<[string, AiProvider, string | null, string | null]>) {
        await expect(aiCredentialsPage.rowProvider(label, providerInfo(provider).label)).toBeVisible();
        await expect(aiCredentialsPage.rowLabel(label)).toBeVisible();
        await expect(aiCredentialsPage.rowMask(label, FAKE_KEY_LAST4)).toBeVisible();
        await expect(aiCredentialsPage.rowModelLine(label, chat, embed)).toBeVisible();
        await expect(aiCredentialsPage.rowStatus(label, null)).toBeVisible();
        // The raw enum never reaches the screen, nor a "null" model.
        await expect(aiCredentialsPage.rowExactText(label, provider)).toHaveCount(0);
        await expect(aiCredentialsPage.row(label)).not.toContainText("null");
      }
      // Newest first.
      await expect(aiCredentialsPage.rows().first()).toContainText(overridden);
    }
  );

  test(
    'tag trạng thái dịch đủ 6 kết quả kiểm tra và "Not tested", không lộ enum',
    { tag: ["@TC-AICREDENTIALS-012"] },
    async ({ aiCredUser, aiCredentialsPage, aiCredData }) => {
      const testedAt = new Date(Date.now() - 10 * 60_000);
      const labels = new Map<string, (typeof TEST_STATUSES)[number] | null>();
      for (const [index, status] of [...TEST_STATUSES, null].entries()) {
        // Labels must not contain the enum: the page text is searched for it below.
        const label = uniqueLabel(`status ${index}`);
        const res = await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });
        if (status) await aiCredData.setVerdict(res.json().id, status, testedAt);
        labels.set(label, status);
      }

      await aiCredentialsPage.open();

      for (const [label, status] of labels) {
        await expect(aiCredentialsPage.rowStatus(label, status), String(status)).toBeVisible();
      }
      const text = await aiCredentialsPage.mainText();
      expect(text).not.toMatch(/\b(invalid_key|no_quota|model_unavailable|unreachable)\b/);
      expect(text).not.toMatch(/credentials\.status/);
    }
  );

  test(
    "mốc kiểm tra hiện thời gian tương đối, tooltip là ngày giờ đầy đủ",
    { tag: ["@TC-AICREDENTIALS-013"] },
    async ({ aiCredUser, aiCredentialsPage, aiCredData }) => {
      const label = uniqueLabel("tested");
      const created = await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });
      await aiCredData.setVerdict(created.json().id, "ok", new Date(Date.now() - 2 * 60_000));
      const testedAt = (await aiCredUser.api.aiCredentials.list()).json()[0].lastTestedAt!;

      await aiCredentialsPage.open();

      const relative = await aiCredentialsPage.browserRelativeMinutes(-2);
      await expect(aiCredentialsPage.rowStatus(label, "ok")).toBeVisible();
      await expect(aiCredentialsPage.rowTestedAt(label, relative)).toBeVisible();

      await aiCredentialsPage.hoverTestedAt(label, relative);
      const full = await aiCredentialsPage.browserDateTime(testedAt);
      await expect(aiCredentialsPage.tooltipWithText(full)).toBeVisible();
    }
  );

  test(
    "credential chưa kiểm tra không hiện mốc thời gian, không có Invalid Date",
    { tag: ["@TC-AICREDENTIALS-014"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      const label = uniqueLabel("untested");
      await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });

      await aiCredentialsPage.open();

      await expect(aiCredentialsPage.rowStatus(label, null)).toBeVisible();
      const row = aiCredentialsPage.row(label);
      for (const junk of ["Invalid Date", "NaN", "null", "undefined"]) await expect(row).not.toContainText(junk);
      // No relative time at all ("… ago" / "in …").
      await expect(row).not.toContainText(await aiCredentialsPage.browserRelativeMinutes(-1));
    }
  );
});
