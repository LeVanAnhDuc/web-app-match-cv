import { t } from "@/data/copy";
import {
  COLLECTION_ENDPOINT,
  FAKE_KEY,
  FAKE_KEY_LAST4,
  KEY_MAX,
  KEY_MIN,
  KEY_PREFIX,
  LABEL_MAX,
  MODEL_MAX,
  TEST_ENDPOINT,
  providerInfo,
  testResult,
  uniqueLabel,
} from "@/data/test-data/ai-credentials";
import { expect, test } from "@/fixtures";

// The add dialog: fields, client-side validation, saving, and the automatic connection test that follows
// (REQ-AICREDENTIALS-13, -15, -16, -21, -22, -23). POST /ai-credentials/:id/test is always stubbed (D1); creating
// itself goes to the real backend, as the test's own throwaway user (aiCredUser).

test.describe("ai-credentials — create and validate", () => {
  test(
    "key gốc không xuất hiện trong DOM của trang credential sau khi tạo",
    { tag: ["@TC-AICREDENTIALS-015", "@smoke"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      void aiCredUser;
      await network.stubJson(TEST_ENDPOINT, testResult("ok"), { method: "POST" });
      const label = uniqueLabel("masked");

      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      await aiCredentialsPage.form.fill({ label, apiKey: FAKE_KEY });
      await aiCredentialsPage.form.save();
      await expect(aiCredentialsPage.form.capabilityLine("chat", "ok")).toBeVisible();
      await aiCredentialsPage.form.cancel();

      await expect(aiCredentialsPage.rowMask(label, FAKE_KEY_LAST4)).toBeVisible();
      const html = await aiCredentialsPage.html();
      expect(html).not.toContain(FAKE_KEY);
      expect(html).not.toContain(KEY_PREFIX);
    }
  );

  test(
    "modal thêm có đủ trường, mặc định OpenRouter, chú thích lưu mã hoá",
    { tag: ["@TC-AICREDENTIALS-019"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      void aiCredUser;
      const openrouter = providerInfo("openrouter");
      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      const form = aiCredentialsPage.form;

      await expect(form.addDialog()).toBeVisible();
      await expect(form.provider()).toBeEnabled();
      await expect(form.textInDialog(openrouter.label)).toBeVisible();
      await expect(form.label()).toHaveValue("");
      await expect(form.apiKey()).toHaveAttribute("type", "password");
      await expect(form.apiKey()).toHaveAttribute("autocomplete", "off");
      await expect(form.message("credentials.form.apiKeyStoredHint")).toBeVisible();
      await expect(form.chatModel()).toHaveAttribute("placeholder", openrouter.defaultChatModel);
      await expect(form.embedModel()).toHaveAttribute("placeholder", openrouter.defaultEmbedModel);
      await expect(form.message("credentials.form.modelHint")).toBeVisible();
      await expect(form.saveButton()).toBeEnabled();
      await expect(form.cancelButton()).toBeEnabled();
    }
  );

  test(
    "đổi provider thì placeholder model đổi theo model mặc định của provider",
    { tag: ["@TC-AICREDENTIALS-020"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      void aiCredUser;
      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      const form = aiCredentialsPage.form;

      for (const id of ["gemini", "openai", "openrouter"] as const) {
        const provider = providerInfo(id);
        await form.chooseProvider(provider.label);
        await expect(form.chatModel(), id).toHaveAttribute("placeholder", provider.defaultChatModel);
        await expect(form.embedModel(), id).toHaveAttribute("placeholder", provider.defaultEmbedModel);
      }
    }
  );

  test(
    "tạo xong modal tự kiểm tra và báo riêng Chat và Embeddings",
    { tag: ["@TC-AICREDENTIALS-024"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      void aiCredUser;
      const tests = network.recordRequests(TEST_ENDPOINT, { method: "POST" });
      await network.stubJson(TEST_ENDPOINT, testResult("ok", "model_unavailable"), { method: "POST", delayMs: 1_500 });
      const label = uniqueLabel("auto test");

      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      await aiCredentialsPage.form.fill({ label, apiKey: FAKE_KEY });
      await aiCredentialsPage.form.save();

      await expect(aiCredentialsPage.form.testingIndicator()).toBeVisible();
      await expect(aiCredentialsPage.form.capabilityLine("chat", "ok")).toBeVisible();
      await expect(aiCredentialsPage.form.capabilityLine("embed", "model_unavailable")).toBeVisible();
      // The dialog stays open until the user closes it; the list behind it already has the row.
      await expect(aiCredentialsPage.form.addDialog()).toBeVisible();
      await expect(aiCredentialsPage.rowLabel(label)).toBeAttached();
      expect(tests).toHaveLength(1);
    }
  );

  test(
    "kiểm tra sau khi tạo lỗi thì credential vẫn được lưu, modal không hiện kết quả",
    { tag: ["@TC-AICREDENTIALS-025"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      await network.failWith(TEST_ENDPOINT, 500, { method: "POST" });
      const label = uniqueLabel("test fails");

      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      await aiCredentialsPage.form.fill({ label, apiKey: FAKE_KEY });
      await aiCredentialsPage.form.save();

      await expect(aiCredentialsPage.rowLabel(label)).toBeAttached();
      await expect(aiCredentialsPage.form.testingIndicator()).toHaveCount(0);
      await expect(aiCredentialsPage.form.anyCapabilityLine()).toHaveCount(0);
      await expect(aiCredentialsPage.form.saveErrorAlert()).toHaveCount(0);
      await aiCredentialsPage.form.cancel();
      await expect(aiCredentialsPage.rowStatus(label, null)).toBeVisible();

      const stored = (await aiCredUser.api.aiCredentials.list()).json();
      expect(stored.map((c) => c.label)).toEqual([label]);
    }
  );

  test(
    "lưu lỗi khác 409 hiện alert không lưu được credential",
    { tag: ["@TC-AICREDENTIALS-026"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      await network.failWith(COLLECTION_ENDPOINT, 500, { method: "POST" });

      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      await aiCredentialsPage.form.fill({ label: uniqueLabel("save fails"), apiKey: FAKE_KEY });
      await aiCredentialsPage.form.save();

      await expect(aiCredentialsPage.form.saveErrorAlert()).toBeVisible();
      await expect(aiCredentialsPage.form.addDialog()).toBeVisible();
      await expect(aiCredentialsPage.form.message("credentials.errors.labelTaken")).toHaveCount(0);
      expect((await aiCredUser.api.aiCredentials.list()).json()).toHaveLength(0);
    }
  );

  // ── client-side validation ─────────────────────────────────────────────────
  test(
    "client chặn tên trống, key trống và key có khoảng trắng mà không gửi request",
    { tag: ["@TC-AICREDENTIALS-069"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      void aiCredUser;
      const creates = network.recordRequests(COLLECTION_ENDPOINT, { method: "POST" });
      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      const form = aiCredentialsPage.form;

      await form.save();
      await expect(form.message("credentials.form.required")).toHaveCount(2);
      await expect(form.label()).toHaveAccessibleDescription(t("credentials.form.required"));
      await expect(form.apiKey()).toHaveAccessibleDescription(new RegExp(t("credentials.form.required")));

      await form.fill({ label: uniqueLabel("spaced key"), apiKey: "sk-with a space-1234567890" });
      await form.save();
      await expect(form.message("credentials.form.noWhitespace")).toBeVisible();

      await expect(form.addDialog()).toBeVisible();
      expect(creates).toHaveLength(0);
    }
  );

  test(
    "form chặn tên chỉ gồm khoảng trắng",
    { tag: ["@TC-AICREDENTIALS-071"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      // BUG: defects/ai-credentials.md#bug-aicredentials-02
      test.fail();
      void aiCredUser;
      await network.stubJson(TEST_ENDPOINT, testResult("ok"), { method: "POST" });
      const creates = network.recordRequests(COLLECTION_ENDPOINT, { method: "POST" });
      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();

      await aiCredentialsPage.form.fill({ label: "   ", apiKey: FAKE_KEY });
      await aiCredentialsPage.form.save();

      await expect(aiCredentialsPage.form.message("credentials.form.required")).toBeVisible({ timeout: 5_000 });
      expect(creates).toHaveLength(0);
    }
  );

  test(
    "form chặn key 19 và 401 ký tự, nhận key 20 ký tự",
    { tag: ["@TC-AICREDENTIALS-075"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      void aiCredUser;
      await network.stubJson(TEST_ENDPOINT, testResult("ok"), { method: "POST" });
      const creates = network.recordRequests(COLLECTION_ENDPOINT, { method: "POST" });
      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      const form = aiCredentialsPage.form;

      await form.fill({ label: uniqueLabel("bva key"), apiKey: "k".repeat(KEY_MIN - 1) });
      await form.save();
      await expect(form.message("credentials.form.keyTooShort")).toBeVisible();

      await form.fill({ apiKey: "k".repeat(KEY_MAX + 1) });
      await form.save();
      await expect(form.message("credentials.form.keyTooLong")).toBeVisible();
      expect(creates).toHaveLength(0);

      await form.fill({ apiKey: "k".repeat(KEY_MIN) });
      await form.save();
      await expect(form.capabilityLine("chat", "ok")).toBeVisible();
      expect(creates).toHaveLength(1);
    }
  );

  test(
    "form chặn tên 61 ký tự, lưu được tên 60 ký tự",
    { tag: ["@TC-AICREDENTIALS-076"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      void aiCredUser;
      await network.stubJson(TEST_ENDPOINT, testResult("ok"), { method: "POST" });
      const creates = network.recordRequests(COLLECTION_ENDPOINT, { method: "POST" });
      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      const form = aiCredentialsPage.form;

      await form.fill({ label: "a".repeat(LABEL_MAX + 1), apiKey: FAKE_KEY });
      await form.save();
      await expect(form.label()).toHaveAccessibleDescription(t("credentials.form.labelTooLong"));
      expect(creates).toHaveLength(0);

      await form.fill({ label: "b".repeat(LABEL_MAX) });
      await form.save();
      await expect(form.capabilityLine("chat", "ok")).toBeVisible();
      expect(creates).toHaveLength(1);
    }
  );

  test(
    "form báo model quá 120 ký tự bằng đúng giới hạn 120",
    { tag: ["@TC-AICREDENTIALS-077"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      // BUG: defects/ai-credentials.md#bug-aicredentials-03
      test.fail();
      void aiCredUser;
      const creates = network.recordRequests(COLLECTION_ENDPOINT, { method: "POST" });
      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      const form = aiCredentialsPage.form;

      await form.fill({ label: uniqueLabel("long model"), apiKey: FAKE_KEY, chatModel: "m".repeat(MODEL_MAX + 1) });
      await form.save();

      // Blocked client-side (fine) — but the message must name the real limit, not the label's 60.
      await expect(form.chatModel()).toHaveAttribute("aria-invalid", "true");
      expect(creates).toHaveLength(0);
      await expect(form.chatModel()).not.toHaveAccessibleDescription(t("credentials.form.labelTooLong"));
      await expect(form.chatModel()).toHaveAccessibleDescription(new RegExp(String(MODEL_MAX)), { timeout: 3_000 });
    }
  );

  // ── duplicates and double submits ──────────────────────────────────────────
  test(
    "tên trùng hiện lỗi ngay dưới ô Name, không phải toast",
    { tag: ["@TC-AICREDENTIALS-080"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      const label = uniqueLabel("dup");
      await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });

      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      await aiCredentialsPage.form.fill({ label, apiKey: FAKE_KEY });
      await aiCredentialsPage.form.save();

      await expect(aiCredentialsPage.form.label()).toHaveAccessibleDescription(t("credentials.errors.labelTaken"));
      await expect(aiCredentialsPage.form.saveErrorAlert()).toHaveCount(0);
      await expect(aiCredentialsPage.form.addDialog()).toBeVisible();
      expect((await aiCredUser.api.aiCredentials.list()).json()).toHaveLength(1);
    }
  );

  test(
    "tên trùng kèm key 19 ký tự: lỗi client thắng, không request nào được gửi",
    { tag: ["@TC-AICREDENTIALS-081"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      const label = uniqueLabel("dup short");
      await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });
      const creates = network.recordRequests(COLLECTION_ENDPOINT, { method: "POST" });

      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      await aiCredentialsPage.form.fill({ label, apiKey: "k".repeat(KEY_MIN - 1) });
      await aiCredentialsPage.form.save();

      await expect(aiCredentialsPage.form.message("credentials.form.keyTooShort")).toBeVisible();
      await expect(aiCredentialsPage.form.message("credentials.errors.labelTaken")).toHaveCount(0);
      expect(creates).toHaveLength(0);
    }
  );

  test(
    "bấm Save hai lần nhanh chỉ tạo một credential",
    { tag: ["@TC-AICREDENTIALS-085"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      // BUG: defects/ai-credentials.md#bug-aicredentials-10
      test.fail();
      await network.stubJson(TEST_ENDPOINT, testResult("ok"), { method: "POST", delayMs: 1_000 });
      const creates = network.recordRequests(COLLECTION_ENDPOINT, { method: "POST" });
      const label = uniqueLabel("double");

      await aiCredentialsPage.open();
      await aiCredentialsPage.openAddDialog();
      await aiCredentialsPage.form.fill({ label, apiKey: FAKE_KEY });
      await aiCredentialsPage.form.saveButton().dblclick();

      await expect(aiCredentialsPage.form.capabilityLine("chat", "ok")).toBeVisible();
      await aiCredentialsPage.form.cancel();
      await expect(aiCredentialsPage.rowLabel(label)).toHaveCount(1);
      expect(creates).toHaveLength(1);
      expect((await aiCredUser.api.aiCredentials.list()).json().filter((c) => c.label === label)).toHaveLength(1);
    }
  );
});
