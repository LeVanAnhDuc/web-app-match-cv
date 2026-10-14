import { expect, test } from "@/fixtures";
import { t, serverMessage } from "@/data/copy";
import {
  DOCX_MIME,
  DOCUMENTS_URL,
  JD_TEXT,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  PDF_MIME,
  blankFile,
  corruptPdf,
  samplePdfAs,
  uniqueText,
} from "@/data/test-data/cv-jd-matching-wizard";
import { FILES } from "@/data/test-data/shared";

// Step 1/2 input: Next gating, double submit, upload/paste modes, client-side file checks, server parse error
// (REQ-03, 04, 10–13, 15). Client-side checks never read file content, so in-memory buffers stand in for files.

test.describe("document input", () => {
  test(
    "Next chỉ mở khi có nội dung: rỗng và khoảng trắng giữ Next tắt, 1 ký tự mở Next",
    { tag: ["@TC-CVJDMATCHINGWIZARD-011"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      await expect(wizardPage.backButton()).toBeDisabled();
      await expect(wizardPage.nextButton()).toBeDisabled();

      await wizardPage.selectPasteMode();
      await expect(wizardPage.nextButton()).toBeDisabled();
      await wizardPage.pasteText("   \n\t ");
      await expect(wizardPage.nextButton()).toBeDisabled();
      await wizardPage.pasteText("x");
      await expect(wizardPage.nextButton()).toBeEnabled();
      await wizardPage.pasteText("");
      await expect(wizardPage.nextButton()).toBeDisabled();
    }
  );

  test(
    "bấm đúp Next chỉ tạo một tài liệu và chỉ sang bước 2",
    { tag: ["@TC-CVJDMATCHINGWIZARD-012"] },
    async ({ wizardPage, network }) => {
      const creates = network.recordRequests(DOCUMENTS_URL, { method: "POST" });
      await wizardPage.goto();
      await wizardPage.pasteText(uniqueText(JD_TEXT));

      await wizardPage.nextButton().dblclick();

      await expect(wizardPage.stepHeading("cv")).toBeVisible();
      await expect(wizardPage.stepperDot(2)).toHaveAttribute("aria-current", "step");
      expect(creates).toHaveLength(1);
      expect(creates[0].body).toMatchObject({ kind: "JD", save: false });
    }
  );

  test(
    "đổi chế độ Upload/Paste xoá lỗi đang hiện và bỏ chọn tài liệu đã lưu",
    { tag: ["@TC-CVJDMATCHINGWIZARD-013"] },
    async ({ wizardPage, wizardApi }) => {
      const title = uniqueText("Saved JD");
      expect((await wizardApi.documents.create({ kind: "JD", save: true, title, sourceText: JD_TEXT })).status).toBe(201);
      await wizardPage.goto();
      await expect(wizardPage.stepHeading("jd")).toBeVisible();
      await expect(wizardPage.modeTab("upload")).toBeVisible();
      await expect(wizardPage.modeTab("paste")).toBeVisible();

      await wizardPage.chooseFile(blankFile("virus.exe", "application/octet-stream", 64));
      await expect(wizardPage.inlineAlert()).toHaveText(t("err.fileType"));
      await wizardPage.selectPasteMode();
      await expect(wizardPage.inlineAlert()).toHaveCount(0);

      await wizardPage.savedRadio(title).check();
      await expect(wizardPage.nextButton()).toBeEnabled();
      await wizardPage.selectUploadMode();
      await expect(wizardPage.savedRadio(title)).not.toBeChecked();
      await expect(wizardPage.nextButton()).toBeDisabled();

      await wizardPage.pasteText(uniqueText(JD_TEXT));
      await wizardPage.nextButton().click();
      await expect(wizardPage.stepHeading("cv")).toBeVisible();
    }
  );

  test(
    "chọn file PDF/DOCX hợp lệ hiện tên file và mở Next, đuôi viết HOA cũng nhận",
    { tag: ["@TC-CVJDMATCHINGWIZARD-014"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      await expect(wizardPage.dropzoneHint(MAX_UPLOAD_LABEL)).toBeVisible();

      await wizardPage.chooseFile(FILES.pdf);
      await expect(wizardPage.dropzoneFileName("sample.pdf")).toBeVisible();
      await expect(wizardPage.nextButton()).toBeEnabled();

      await wizardPage.chooseFile(FILES.docx);
      await expect(wizardPage.dropzoneFileName("sample.docx")).toBeVisible();
      await expect(wizardPage.nextButton()).toBeEnabled();

      await wizardPage.chooseFile(samplePdfAs("RESUME.PDF"));
      await expect(wizardPage.dropzoneFileName("RESUME.PDF")).toBeVisible();
      await expect(wizardPage.inlineAlert()).toHaveCount(0);
      await expect(wizardPage.nextButton()).toBeEnabled();
    }
  );

  for (const file of [
    blankFile("malware.exe", "application/octet-stream", 128),
    blankFile("photo.png", "image/png", 128),
  ]) {
    test(
      `file sai loại bị chặn ở client, không gửi request (${file.name})`,
      { tag: ["@TC-CVJDMATCHINGWIZARD-015"] },
      async ({ wizardPage, network }) => {
        const creates = network.recordRequests(DOCUMENTS_URL, { method: "POST" });
        await wizardPage.goto();

        await wizardPage.chooseFile(file);

        await expect(wizardPage.inlineAlert()).toHaveText(t("err.fileType"));
        await expect(wizardPage.nextButton()).toBeDisabled();
        expect(creates).toHaveLength(0);
      }
    );
  }

  test(
    "biên 10 MB ở client: đúng giới hạn được nhận, vượt 1 byte bị chặn",
    { tag: ["@TC-CVJDMATCHINGWIZARD-016"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();

      await wizardPage.chooseFile(blankFile("below.pdf", PDF_MIME, MAX_UPLOAD_BYTES - 1));
      await expect(wizardPage.inlineAlert()).toHaveCount(0);
      await expect(wizardPage.nextButton()).toBeEnabled();

      await wizardPage.chooseFile(blankFile("exact.docx", DOCX_MIME, MAX_UPLOAD_BYTES));
      await expect(wizardPage.inlineAlert()).toHaveCount(0);
      await expect(wizardPage.dropzoneFileName("exact.docx")).toBeVisible();

      await wizardPage.chooseFile(blankFile("over.pdf", PDF_MIME, MAX_UPLOAD_BYTES + 1));
      await expect(wizardPage.inlineAlert()).toHaveText(t("err.fileSize", "en", { max: MAX_UPLOAD_LABEL }));
      await expect(wizardPage.dropzoneFileName("over.pdf")).toHaveCount(0);
    }
  );

  test(
    "vừa sai loại vừa quá cỡ thì báo lỗi loại",
    { tag: ["@TC-CVJDMATCHINGWIZARD-017"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();

      await wizardPage.chooseFile(blankFile("huge.exe", "application/octet-stream", MAX_UPLOAD_BYTES + 1));

      await expect(wizardPage.inlineAlert()).toHaveText(t("err.fileType"));
      await expect(wizardPage.nextButton()).toBeDisabled();
    }
  );

  test(
    "file hỏng báo lỗi đọc file inline và vẫn ở bước đang nạp",
    { tag: ["@TC-CVJDMATCHINGWIZARD-018"] },
    async ({ wizardPage }) => {
      await wizardPage.goto();
      await wizardPage.chooseFile(corruptPdf());

      const rejected = wizardPage.page.waitForResponse(
        (r) => DOCUMENTS_URL.test(r.url()) && r.request().method() === "POST"
      );
      await wizardPage.nextButton().click();
      expect((await rejected).status()).toBe(400);

      await expect(wizardPage.inlineAlert()).toHaveText(serverMessage("documents.errors.parseFailed"));
      await expect(wizardPage.stepHeading("jd")).toBeVisible();
      await expect(wizardPage.stepperDot(1)).toHaveAttribute("aria-current", "step");
    }
  );
});
