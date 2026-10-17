import { t } from "@/data/copy";
import {
  FAKE_KEY,
  FAKE_KEY_LAST4,
  KEY_PREFIX,
  TEST_ENDPOINT,
  WIZARD_CV_TEXT,
  WIZARD_JD_TEXT,
  providerInfo,
  testResult,
  uniqueLabel,
} from "@/data/test-data/ai-credentials";
import { expect, test } from "@/fixtures";

// Wizard step 3 "Run with" as far as credentials go (REQ-AICREDENTIALS-34 … -37, -13). Running the match itself
// belongs to multi-provider-compare / cv-jd-matching-wizard; nothing here clicks "Run match".
// Each test is its own user (aiCredUser): their credentials are exactly the ones seeded here, and pasting the JD/CV
// creates throwaway documents that go away with the user.

test.describe("ai-credentials — wizard Run with", () => {
  test(
    "step 3 liệt kê credential và key hệ thống; thêm credential từ step 3 tự tick credential mới",
    { tag: ["@TC-AICREDENTIALS-046"] },
    async ({ aiCredUser, runWithStep, network }) => {
      const older = uniqueLabel("older");
      const newer = uniqueLabel("newer");
      const added = uniqueLabel("added");
      await aiCredUser.api.aiCredentials.create({ provider: "gemini", label: older, apiKey: FAKE_KEY });
      await aiCredUser.api.aiCredentials.create({ provider: "openai", label: newer, apiKey: FAKE_KEY });
      await network.stubJson(TEST_ENDPOINT, testResult("ok"), { method: "POST" });

      await runWithStep.gotoReview(WIZARD_JD_TEXT, WIZARD_CV_TEXT);

      for (const [label, provider] of [
        [older, providerInfo("gemini").label],
        [newer, providerInfo("openai").label],
      ]) {
        const box = runWithStep.credentialCheckbox(label);
        await expect(box).toBeVisible();
        // provider tag · label · ••••last4 · status tag (no timestamp in the picker)
        await expect(box).toHaveAccessibleName(
          new RegExp(`${provider}.*${label}.*••••${FAKE_KEY_LAST4}.*${t("credentials.status.untested")}`)
        );
      }
      await expect(runWithStep.systemKeyCheckbox()).toBeVisible();
      await expect(runWithStep.systemKeyTag()).toBeVisible();
      await expect(runWithStep.checkboxes()).toHaveCount(3);

      await runWithStep.openAddCredential();
      await expect(runWithStep.form.addDialog()).toBeVisible();
      await runWithStep.form.fill({ label: added, apiKey: FAKE_KEY });
      await runWithStep.form.save();
      await expect(runWithStep.form.capabilityLine("chat", "ok")).toBeVisible();
      await runWithStep.form.cancel();

      await expect(runWithStep.credentialCheckbox(added)).toBeChecked();
      await expect(runWithStep.checkboxes()).toHaveCount(4);
      const html = await runWithStep.html();
      expect(html).not.toContain(FAKE_KEY);
      expect(html).not.toContain(KEY_PREFIX);
    }
  );

  test(
    "step 3 mặc định chọn credential dùng gần nhất",
    { tag: ["@TC-AICREDENTIALS-047"] },
    async ({ aiCredUser, aiCredData, runWithStep }) => {
      const recent = uniqueLabel("recent");
      const stale = uniqueLabel("stale");
      const a = await aiCredUser.api.aiCredentials.create({ provider: "gemini", label: recent, apiKey: FAKE_KEY });
      const b = await aiCredUser.api.aiCredentials.create({ provider: "openai", label: stale, apiKey: FAKE_KEY });
      // The OLDER credential ran most recently: recency of use wins over recency of creation.
      await aiCredData.markUsed(a.json().id, new Date(Date.now() - 60_000));
      await aiCredData.markUsed(b.json().id, new Date(Date.now() - 24 * 60 * 60_000));

      await runWithStep.gotoReview(WIZARD_JD_TEXT, WIZARD_CV_TEXT);

      await expect(runWithStep.credentialCheckbox(recent)).toBeChecked();
      await expect(runWithStep.credentialCheckbox(stale)).not.toBeChecked();
      await expect(runWithStep.systemKeyCheckbox()).not.toBeChecked();
      await expect(runWithStep.privacyLine([providerInfo("gemini").label])).toBeVisible();
    }
  );

  test(
    "chưa credential nào từng chạy thì step 3 chọn credential mới tạo nhất",
    { tag: ["@TC-AICREDENTIALS-048"] },
    async ({ aiCredUser, runWithStep }) => {
      const first = uniqueLabel("first");
      const latest = uniqueLabel("latest");
      await aiCredUser.api.aiCredentials.create({ provider: "gemini", label: first, apiKey: FAKE_KEY });
      await aiCredUser.api.aiCredentials.create({ provider: "openai", label: latest, apiKey: FAKE_KEY });

      await runWithStep.gotoReview(WIZARD_JD_TEXT, WIZARD_CV_TEXT);

      await expect(runWithStep.credentialCheckbox(latest)).toBeChecked();
      await expect(runWithStep.credentialCheckbox(first)).not.toBeChecked();
      await expect(runWithStep.systemKeyCheckbox()).not.toBeChecked();
    }
  );

  test(
    "chưa có credential nào thì step 3 mặc định key hệ thống, không cảnh báo",
    { tag: ["@TC-AICREDENTIALS-049"] },
    async ({ aiCredUser, runWithStep }) => {
      void aiCredUser;
      await runWithStep.gotoReview(WIZARD_JD_TEXT, WIZARD_CV_TEXT);

      await expect(runWithStep.systemKeyCheckbox()).toBeChecked();
      await expect(runWithStep.checkboxes()).toHaveCount(1);
      await expect(runWithStep.privacyLine([t("credentials.runWith.privacySystemEntry")])).toBeVisible();
      await expect(runWithStep.anyUntestedWarning()).toHaveCount(0);
    }
  );

  test(
    "credential chưa qua kiểm tra vẫn chọn được và cảnh báo đếm số nhiều đúng",
    { tag: ["@TC-AICREDENTIALS-050"] },
    async ({ aiCredUser, aiCredData, runWithStep }) => {
      const passed = uniqueLabel("passed");
      const untested = uniqueLabel("untested");
      const failed = uniqueLabel("failed");
      const a = await aiCredUser.api.aiCredentials.create({ provider: "openrouter", label: passed, apiKey: FAKE_KEY });
      await aiCredUser.api.aiCredentials.create({ provider: "openai", label: untested, apiKey: FAKE_KEY });
      const c = await aiCredUser.api.aiCredentials.create({ provider: "gemini", label: failed, apiKey: FAKE_KEY });
      await aiCredData.setVerdict(a.json().id, "ok", new Date());
      await aiCredData.setVerdict(c.json().id, "invalid_key", new Date());

      await runWithStep.gotoReview(WIZARD_JD_TEXT, WIZARD_CV_TEXT);

      // Default = newest (none ran yet) = the failed one: selectable, with a singular warning.
      await expect(runWithStep.credentialCheckbox(failed)).toBeChecked();
      await expect(runWithStep.untestedWarning(1)).toBeVisible();

      await runWithStep.credentialCheckbox(untested).check();
      await expect(runWithStep.untestedWarning(2)).toBeVisible();

      // A passed credential adds nothing to the count.
      await runWithStep.credentialCheckbox(passed).check();
      await expect(runWithStep.untestedWarning(2)).toBeVisible();

      await runWithStep.credentialCheckbox(failed).uncheck();
      await runWithStep.credentialCheckbox(untested).uncheck();
      await expect(runWithStep.anyUntestedWarning()).toHaveCount(0);
      await expect(runWithStep.credentialCheckbox(passed)).toBeChecked();
    }
  );

  test(
    "credential bị xoá ở nơi khác rơi khỏi lựa chọn khi danh sách làm mới",
    { tag: ["@TC-AICREDENTIALS-051"] },
    async ({ aiCredUser, runWithStep, network }) => {
      const kept = uniqueLabel("kept");
      const doomed = uniqueLabel("doomed");
      const added = uniqueLabel("added");
      await aiCredUser.api.aiCredentials.create({ provider: "gemini", label: kept, apiKey: FAKE_KEY });
      const d = await aiCredUser.api.aiCredentials.create({ provider: "openai", label: doomed, apiKey: FAKE_KEY });
      await network.stubJson(TEST_ENDPOINT, testResult("ok"), { method: "POST" });

      await runWithStep.gotoReview(WIZARD_JD_TEXT, WIZARD_CV_TEXT);
      await expect(runWithStep.credentialCheckbox(doomed)).toBeChecked();
      await runWithStep.credentialCheckbox(kept).check();

      // Deleted elsewhere (another tab), then the list refreshes — here because a new credential is added.
      expect((await aiCredUser.api.aiCredentials.remove(d.json().id)).status).toBe(204);
      await runWithStep.openAddCredential();
      await runWithStep.form.fill({ label: added, apiKey: FAKE_KEY });
      await runWithStep.form.save();
      await expect(runWithStep.form.capabilityLine("chat", "ok")).toBeVisible();
      await runWithStep.form.cancel();

      await expect(runWithStep.credentialCheckbox(doomed)).toHaveCount(0);
      await expect(runWithStep.credentialCheckbox(kept)).toBeChecked();
      await expect(runWithStep.credentialCheckbox(added)).toBeChecked();
      // The privacy line no longer names the deleted credential's provider (list order: newest first).
      await expect(
        runWithStep.privacyLine([providerInfo("openrouter").label, providerInfo("gemini").label])
      ).toBeVisible();
    }
  );
});
