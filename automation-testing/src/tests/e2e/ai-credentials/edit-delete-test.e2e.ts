import {
  FAKE_KEY,
  ITEM_ENDPOINT,
  ROTATED_KEY,
  ROTATED_KEY_LAST4,
  TEST_ENDPOINT,
  providerInfo,
  testResult,
  uniqueLabel,
} from "@/data/test-data/ai-credentials";
import { expect, test } from "@/fixtures";

// Row actions on the credentials page: Edit, Delete, Test (REQ-AICREDENTIALS-23 … -27, -31).
// POST /:id/test is stubbed (D1). A stubbed test persists nothing, so where the row must show a fresh verdict the
// spec stamps that verdict in the DB first — exactly what the real endpoint would have stored — and lets the list
// refetch that the mutation triggers pick it up.

test.describe("ai-credentials — edit, delete, test", () => {
  test(
    "modal sửa khoá provider, điền sẵn tên và model, ô key trống",
    { tag: ["@TC-AICREDENTIALS-027"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      const label = uniqueLabel("edit");
      await aiCredUser.api.aiCredentials.create({ provider: "gemini", label, apiKey: FAKE_KEY, chatModel: "gemini-2.0-pro" });
      const tests = network.recordRequests(TEST_ENDPOINT, { method: "POST" });

      await aiCredentialsPage.open();
      await aiCredentialsPage.openEditDialog(label);
      const form = aiCredentialsPage.form;

      await expect(form.editDialog()).toBeVisible();
      await expect(form.provider()).toBeDisabled();
      await expect(form.textInDialog(providerInfo("gemini").label)).toBeVisible();
      await expect(form.message("credentials.form.providerLocked")).toBeVisible();
      await expect(form.label()).toHaveValue(label);
      await expect(form.chatModel()).toHaveValue("gemini-2.0-pro");
      await expect(form.embedModel()).toHaveValue("");
      await expect(form.apiKey()).toHaveValue("");
      await expect(form.message("credentials.form.apiKeyKeepHint")).toBeVisible();

      // The key is not required when editing: saving untouched just closes.
      await form.save();
      await expect(form.editDialog()).toBeHidden();
      await expect(form.message("credentials.form.required")).toHaveCount(0);
      expect(tests).toHaveLength(0);
    }
  );

  test(
    'đổi key trong modal sửa thì tự kiểm tra lại và dòng về "Not tested"',
    { tag: ["@TC-AICREDENTIALS-033"] },
    async ({ aiCredUser, aiCredentialsPage, aiCredData, network }) => {
      const label = uniqueLabel("rotate");
      const created = await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });
      await aiCredData.setVerdict(created.json().id, "ok", new Date(Date.now() - 60 * 60_000));
      const tests = network.recordRequests(TEST_ENDPOINT, { method: "POST" });
      await network.stubJson(TEST_ENDPOINT, testResult("ok"), { method: "POST" });

      await aiCredentialsPage.open();
      await expect(aiCredentialsPage.rowStatus(label, "ok")).toBeVisible();
      await aiCredentialsPage.openEditDialog(label);
      await aiCredentialsPage.form.fill({ apiKey: ROTATED_KEY });
      await aiCredentialsPage.form.save();

      await expect(aiCredentialsPage.form.capabilityLine("chat", "ok")).toBeVisible();
      expect(tests).toHaveLength(1);
      await aiCredentialsPage.form.cancel();

      // The server dropped the old verdict with the old key (the stubbed re-test stored nothing).
      await expect(aiCredentialsPage.rowStatus(label, null)).toBeVisible();
      await expect(aiCredentialsPage.rowMask(label, ROTATED_KEY_LAST4)).toBeVisible();
    }
  );

  test(
    "chỉ đổi tên thì modal đóng ngay, không kiểm tra lại",
    { tag: ["@TC-AICREDENTIALS-034"] },
    async ({ aiCredUser, aiCredentialsPage, aiCredData, network }) => {
      // BUG: defects/ai-credentials.md#bug-aicredentials-09
      test.fail();
      const label = uniqueLabel("rename");
      const renamed = uniqueLabel("renamed");
      const created = await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });
      await aiCredData.setVerdict(created.json().id, "ok", new Date(Date.now() - 60 * 60_000));
      const tests = network.recordRequests(TEST_ENDPOINT, { method: "POST" });

      await aiCredentialsPage.open();
      await aiCredentialsPage.openEditDialog(label);
      await aiCredentialsPage.form.fill({ label: renamed });
      await aiCredentialsPage.form.save();

      await expect(aiCredentialsPage.form.editDialog()).toBeHidden();
      await expect(aiCredentialsPage.rowStatus(renamed, "ok")).toBeVisible();
      expect(tests).toHaveLength(0);
    }
  );

  test(
    "xoá cần xác nhận: Cancel giữ dòng, xác nhận thì dòng biến mất và báo đã xoá",
    { tag: ["@TC-AICREDENTIALS-035"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      const label = uniqueLabel("delete");
      await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });

      await aiCredentialsPage.open();
      await aiCredentialsPage.askDelete(label);
      await expect(aiCredentialsPage.deleteConfirmHint()).toBeVisible();
      await aiCredentialsPage.deleteCancelButton().click();
      await expect(aiCredentialsPage.deleteConfirm()).toBeHidden();
      await expect(aiCredentialsPage.rowLabel(label)).toBeVisible();

      await aiCredentialsPage.askDelete(label);
      await aiCredentialsPage.deleteConfirmButton().click();

      await expect(aiCredentialsPage.toast("credentials.delete.success")).toBeVisible();
      await expect(aiCredentialsPage.rowLabel(label)).toHaveCount(0);
      expect((await aiCredUser.api.aiCredentials.list()).json()).toHaveLength(0);
    }
  );

  test(
    "xoá lỗi hiện toast không xoá được, dòng vẫn còn",
    { tag: ["@TC-AICREDENTIALS-036"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      const label = uniqueLabel("delete fails");
      await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });
      await network.failWith(ITEM_ENDPOINT, 500, { method: "DELETE" });

      await aiCredentialsPage.open();
      await aiCredentialsPage.askDelete(label);
      await aiCredentialsPage.deleteConfirmButton().click();

      await expect(aiCredentialsPage.toast("credentials.delete.failed")).toBeVisible();
      await expect(aiCredentialsPage.rowLabel(label)).toBeVisible();
    }
  );

  test(
    "nút Test của dòng quay loading khi chạy, xong báo đã kiểm tra và dòng cập nhật tag",
    { tag: ["@TC-AICREDENTIALS-039"] },
    async ({ aiCredUser, aiCredentialsPage, aiCredData, network }) => {
      const label = uniqueLabel("row test");
      const created = await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });
      await network.stubJson(TEST_ENDPOINT, testResult("ok"), { method: "POST", delayMs: 1_500 });

      await aiCredentialsPage.open();
      await expect(aiCredentialsPage.rowStatus(label, null)).toBeVisible();
      // What the real endpoint stores; the list refetch after the mutation reads it back.
      await aiCredData.setVerdict(created.json().id, "ok", new Date());

      await aiCredentialsPage.testButton(label).click();
      await expect(aiCredentialsPage.loadingSpinner(aiCredentialsPage.testButton(label))).toBeVisible();

      await expect(aiCredentialsPage.toast("credentials.test.success")).toBeVisible();
      await expect(aiCredentialsPage.rowStatus(label, "ok")).toBeVisible();
      await expect(aiCredentialsPage.rowTestedAt(label, await aiCredentialsPage.browserRelativeMinutes(0))).toBeVisible();
      await expect(aiCredentialsPage.loadingSpinner(aiCredentialsPage.testButton(label))).toHaveCount(0);
    }
  );

  test(
    "Test lỗi request hiện toast không kiểm tra được",
    { tag: ["@TC-AICREDENTIALS-040"] },
    async ({ aiCredUser, aiCredentialsPage, network }) => {
      const label = uniqueLabel("row test fails");
      await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });
      await network.failWith(TEST_ENDPOINT, 500, { method: "POST" });

      await aiCredentialsPage.open();
      await aiCredentialsPage.testButton(label).click();

      await expect(aiCredentialsPage.toast("credentials.test.failed")).toBeVisible();
      await expect(aiCredentialsPage.rowStatus(label, null)).toBeVisible();
    }
  );

  test(
    "sửa credential đã bị xoá ở tab khác thì báo không lưu được",
    { tag: ["@TC-AICREDENTIALS-078"] },
    async ({ aiCredUser, aiCredentialsPage }) => {
      const label = uniqueLabel("stale");
      const created = await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label, apiKey: FAKE_KEY });

      await aiCredentialsPage.open();
      await aiCredentialsPage.openEditDialog(label);
      // Deleted behind this tab's back, as a second tab would.
      expect((await aiCredUser.api.aiCredentials.remove(created.json().id)).status).toBe(204);
      await aiCredentialsPage.form.fill({ label: uniqueLabel("too late") });
      await aiCredentialsPage.form.save();

      await expect(aiCredentialsPage.form.saveErrorAlert()).toBeVisible();
      await expect(aiCredentialsPage.form.editDialog()).toBeVisible();
    }
  );
});
