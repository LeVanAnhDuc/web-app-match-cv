import { expect, test } from "@/fixtures";
import { t } from "@/data/copy";
import { CV_TEXT, DOCUMENTS_URL, JD_TEXT, uniqueText } from "@/data/test-data/cv-jd-matching-wizard";
import { FILES } from "@/data/test-data/shared";
import { createSignedInUser, deleteUsers } from "@/utils/sessions";

// Save for reuse + the saved-documents list of steps 1/2 (REQ-19, 21, 22, 50). Each test's user starts with an empty
// library (fixture wizardUser); documents are seeded through the API as that user.

test.describe("save for reuse", () => {
  test(
    "modal lưu bắt nhập tên, lưu xong Next dùng luôn tài liệu vừa lưu",
    { tag: ["@TC-CVJDMATCHINGWIZARD-035"] },
    async ({ wizardPage, network }) => {
      const creates = network.recordRequests(DOCUMENTS_URL, { method: "POST" });
      const name = uniqueText("Saved JD");
      await wizardPage.goto();
      await expect(wizardPage.saveButton()).toHaveCount(0);
      await wizardPage.pasteText(uniqueText(JD_TEXT));

      await wizardPage.saveButton().click();
      const dialog = wizardPage.saveDialog;
      await expect(dialog.root()).toBeVisible();
      await expect(dialog.description()).toBeVisible();
      await expect(dialog.nameInput()).toBeVisible();

      await dialog.confirmButton().click();
      await expect(dialog.alert()).toHaveText(t("save.nameRequired"));
      await expect(dialog.root()).toBeVisible();
      expect(creates).toHaveLength(0);

      await dialog.nameInput().fill(name);
      await dialog.confirmButton().click();
      await expect(dialog.root()).toBeHidden();
      await expect(wizardPage.savedConfirmation(name)).toBeVisible();
      expect(creates).toHaveLength(1);
      expect(creates[0].body).toMatchObject({ kind: "JD", save: true, title: name });

      await wizardPage.nextButton().click();
      await expect(wizardPage.stepHeading("cv")).toBeVisible();
      expect(creates).toHaveLength(1);
    }
  );
});

test.describe("saved documents list", () => {
  test(
    "danh sách chọn lại chỉ có tài liệu đã lưu đúng loại của mình, mới nhất trước",
    { tag: ["@TC-CVJDMATCHINGWIZARD-036"] },
    async ({ wizardPage, wizardApi, apiAs }) => {
      const older = uniqueText("Older JD");
      const newer = uniqueText("Newer JD");
      const word = uniqueText("Word JD");
      const savedCv = uniqueText("Saved CV");
      const foreign = uniqueText("Foreign JD");
      expect((await wizardApi.documents.create({ kind: "JD", save: true, title: older, sourceText: JD_TEXT })).status).toBe(201);
      expect((await wizardApi.documents.create({ kind: "JD", save: true, title: newer, sourceText: JD_TEXT })).status).toBe(201);
      expect((await wizardApi.documents.upload({ kind: "JD", save: true, title: word, file: FILES.docx })).status).toBe(201);
      expect((await wizardApi.documents.create({ kind: "JD", save: false, sourceText: uniqueText("Transient JD") })).status).toBe(201);
      expect((await wizardApi.documents.create({ kind: "CV", save: true, title: savedCv, sourceText: CV_TEXT })).status).toBe(201);
      const other = await createSignedInUser();
      try {
        expect((await apiAs(other).documents.create({ kind: "JD", save: true, title: foreign, sourceText: JD_TEXT })).status).toBe(201);

        await wizardPage.goto();
        await expect(wizardPage.reuseTitle("jd")).toBeVisible();
        await expect(wizardPage.savedRadios()).toHaveCount(3);
        await expect(wizardPage.savedRadios().nth(0)).toHaveAccessibleName(new RegExp(word));
        await expect(wizardPage.savedRadios().nth(1)).toHaveAccessibleName(new RegExp(newer));
        await expect(wizardPage.savedRadios().nth(2)).toHaveAccessibleName(new RegExp(older));
        await expect(wizardPage.savedRadio(foreign)).toHaveCount(0);
        await expect(wizardPage.savedRadio(savedCv)).toHaveCount(0);
        // Format badge is the mapped label, not the raw enum.
        await expect(wizardPage.savedRow(newer)).toContainText(wizardPage.formatLabel("text"));
        await expect(wizardPage.savedRow(newer)).not.toContainText("text");
        await expect(wizardPage.savedRow(word)).toContainText(wizardPage.formatLabel("docx"));
        await expect(wizardPage.savedRow(word)).not.toContainText("docx");

        await wizardPage.submitJd(uniqueText(JD_TEXT));
        await expect(wizardPage.reuseTitle("cv")).toBeVisible();
        await expect(wizardPage.savedRadios()).toHaveCount(1);
        await expect(wizardPage.savedRadio(savedCv)).toBeVisible();
      } finally {
        await deleteUsers([other.userId]);
      }
    }
  );

  test(
    "chọn tài liệu đã lưu rồi Next không tạo tài liệu mới",
    { tag: ["@TC-CVJDMATCHINGWIZARD-037"] },
    async ({ wizardPage, wizardApi, network }) => {
      const title = uniqueText("Saved JD");
      const jdText = uniqueText(JD_TEXT);
      expect((await wizardApi.documents.create({ kind: "JD", save: true, title, sourceText: jdText })).status).toBe(201);
      const creates = network.recordRequests(DOCUMENTS_URL, { method: "POST" });

      await wizardPage.goto();
      await wizardPage.savedRadio(title).check();
      await expect(wizardPage.nextButton()).toBeEnabled();
      await wizardPage.nextButton().click();
      await expect(wizardPage.stepHeading("cv")).toBeVisible();
      expect(creates).toHaveLength(0);

      await wizardPage.submitCv(uniqueText(CV_TEXT));
      await expect(wizardPage.reviewText(jdText)).toBeVisible();
      expect(creates).toHaveLength(1);
    }
  );

  test(
    "chưa lưu gì thì hiện empty state ở bước 1 và bước 2",
    { tag: ["@TC-CVJDMATCHINGWIZARD-038"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      await expect(wizardPage.emptyState("jd")).toBeVisible();
      await expect(wizardPage.emptyHint()).toBeVisible();
      await expect(wizardPage.savedList()).toHaveCount(0);

      await wizardPage.submitJd(uniqueText(JD_TEXT));
      await expect(wizardPage.emptyState("cv")).toBeVisible();
      await expect(wizardPage.emptyHint()).toBeVisible();
    }
  );

  test(
    "không tải được danh sách thì báo lỗi thay vì empty state",
    { tag: ["@TC-CVJDMATCHINGWIZARD-039"] },
    async ({ wizardPage, network }) => {
      // BUG: defects/cv-jd-matching-wizard.md#bug-cvjdmatchingwizard-04
      test.fail();
      // Fault injection (decisions Q7): the list request fails; nothing else is stubbed.
      await network.failWith(DOCUMENTS_URL, 500, { method: "GET" });
      await wizardPage.goto();

      await expect(wizardPage.inlineAlert()).toBeVisible({ timeout: 20_000 });
      await expect(wizardPage.emptyState("jd")).toHaveCount(0);
    }
  );

  test(
    "ngày của tài liệu đã lưu theo ngôn ngữ giao diện",
    { tag: ["@TC-CVJDMATCHINGWIZARD-040"] },
    async ({ wizardPage, wizardApi }) => {
      const title = uniqueText("Dated JD");
      const created = await wizardApi.documents.create({ kind: "JD", save: true, title, sourceText: JD_TEXT });
      expect(created.status).toBe(201);
      const createdAt = new Date(created.json().createdAt as unknown as string);

      await wizardPage.goto();
      await expect(wizardPage.savedRow(title)).toContainText(createdAt.toLocaleDateString("en"));

      await wizardPage.setLanguage("vi");
      await expect(wizardPage.savedRow(title)).toContainText(createdAt.toLocaleDateString("vi"));
    }
  );
});
