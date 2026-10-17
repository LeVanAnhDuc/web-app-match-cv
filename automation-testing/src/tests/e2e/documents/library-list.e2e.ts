import { test, expect } from "@/fixtures";
import { t } from "@/data/copy";
import { LIMITS, repeat } from "@/data/test-data/documents";
import { FILES } from "@/data/test-data/shared";

// /cv and /jd for a signed-in user (REQ-DOCUMENTS-22…25, 32, 33, 37). The tab is signed in as a fresh user
// (docOwner), so counts, order and the empty state are exact. Only the loading / error cases control the network
// (one non-AI request each, decision Q11); everything else hits the real backend.

const LOAD_TIMEOUT = 20_000; // react-query retries a failed list 3× with back-off before showing the error

test.describe("Thư viện tài liệu đã lưu", { tag: ["@creates-data"] }, () => {
  test("/cv liệt kê CV đã lưu của mình, mới nhất trước, với số đếm đúng", { tag: ["@TC-DOCUMENTS-052", "@smoke"] }, async ({ docLibraryPage, docOwner, docStranger }) => {
    const older = await docOwner.paste("CV");
    const newer = await docOwner.upload("CV", FILES.pdf);
    const unsaved = await docOwner.paste("CV", { save: false });
    const jd = await docOwner.paste("JD");

    await docLibraryPage.gotoLoaded("cv");

    await expect(docLibraryPage.heading("cv")).toBeVisible();
    await expect(docLibraryPage.subtitle(2)).toBeVisible();
    await expect(docLibraryPage.rows()).toHaveCount(2);
    expect(await docLibraryPage.titlesInOrder()).toEqual([newer.title, older.title]);
    for (const hidden of [unsaved.title, jd.title, docStranger.title]) {
      await expect(docLibraryPage.row(hidden)).toHaveCount(0);
    }
  });

  test("/jd chỉ liệt kê JD đã lưu với tiêu đề và số đếm của JD", { tag: ["@TC-DOCUMENTS-053"] }, async ({ docLibraryPage, docOwner }) => {
    const jd = await docOwner.paste("JD");
    const cv = await docOwner.paste("CV");

    await docLibraryPage.gotoLoaded("jd");

    await expect(docLibraryPage.heading("jd")).toBeVisible();
    await expect(docLibraryPage.subtitle(1)).toBeVisible();
    await expect(docLibraryPage.row(jd.title)).toBeVisible();
    await expect(docLibraryPage.row(cv.title)).toHaveCount(0);
  });

  test("mỗi dòng có badge định dạng dễ đọc và ngày tạo theo locale", { tag: ["@TC-DOCUMENTS-054"] }, async ({ docLibraryPage, docOwner }) => {
    const pdf = await docOwner.upload("CV", FILES.pdf);
    const docx = await docOwner.upload("CV", FILES.docx);
    const text = await docOwner.paste("CV");

    await docLibraryPage.gotoLoaded("cv");

    await expect(docLibraryPage.formatBadge(pdf.title, "pdf")).toBeVisible();
    await expect(docLibraryPage.formatBadge(docx.title, "docx")).toBeVisible();
    await expect(docLibraryPage.formatBadge(text.title, "text")).toBeVisible();
    await expect(docLibraryPage.row(pdf.title)).not.toContainText(/\b(pdf|docx|text)\b/);
    const expected = new Intl.DateTimeFormat("en").format(new Date(String(text.createdAt)));
    await expect(docLibraryPage.dateText(text.title)).toHaveText(expected);
  });

  test("title 200 ký tự được cắt dòng và không làm trang cuộn ngang", { tag: ["@TC-DOCUMENTS-055"] }, async ({ docLibraryPage, docOwner }) => {
    const long = await docOwner.paste("CV", { title: repeat(LIMITS.title, "W") });

    await docLibraryPage.gotoLoaded("cv");

    await expect(docLibraryPage.row(long.title)).toBeVisible();
    expect(await docLibraryPage.hasHorizontalOverflow()).toBe(false);
  });

  test("menu hành động có đúng các mục theo loại tài liệu và trang", { tag: ["@TC-DOCUMENTS-056"] }, async ({ docLibraryPage, docOwner }) => {
    const label = (key: Parameters<typeof t>[0]) => t(key);
    const parentCv = await docOwner.paste("CV");
    const childCv = await docOwner.upload("CV", FILES.pdf);
    await docOwner.api.documents.setParent(childCv.id, parentCv.id);
    const parentJd = await docOwner.paste("JD");
    const childJd = await docOwner.upload("JD", FILES.docx);
    await docOwner.api.documents.setParent(childJd.id, parentJd.id);

    await docLibraryPage.gotoLoaded("cv");

    await docLibraryPage.openMenu(childCv.title);
    expect(await docLibraryPage.menuLabels()).toEqual([
      label("library.action.preview"),
      label("library.action.rename"),
      label("library.action.compare"),
      label("library.action.setLineage"),
      label("library.action.download"),
      label("library.action.delete"),
    ]);
    await docLibraryPage.page.keyboard.press("Escape");
    await expect(docLibraryPage.menu()).toHaveCount(0);

    await docLibraryPage.openMenu(parentCv.title);
    expect(await docLibraryPage.menuLabels()).toEqual([
      label("library.action.preview"),
      label("library.action.rename"),
      label("library.action.setLineage"),
      label("library.action.delete"),
    ]);
    await docLibraryPage.page.keyboard.press("Escape");

    await docLibraryPage.gotoLoaded("jd");
    await docLibraryPage.openMenu(childJd.title);
    expect(await docLibraryPage.menuLabels()).toEqual([
      label("library.action.preview"),
      label("library.action.rename"),
      label("library.action.setLineage"),
      label("library.action.download"),
      label("library.action.delete"),
    ]);
  });

  test("thư viện rỗng hiện trạng thái rỗng và nút bắt đầu match dẫn tới /wizard", { tag: ["@TC-DOCUMENTS-057"] }, async ({ docLibraryPage, docOwner }) => {
    await docOwner.paste("CV", { save: false });

    await docLibraryPage.gotoLoaded("cv");

    await expect(docLibraryPage.emptyMessage("cv")).toBeVisible();
    await expect(docLibraryPage.emptyHint()).toBeVisible();
    await expect(docLibraryPage.subtitle(0)).toBeVisible();
    await docLibraryPage.emptyCta().click();
    await expect(docLibraryPage.page).toHaveURL(/\/wizard$/);
  });

  test("trong lúc tải chưa hiện số đếm hay trạng thái rỗng", { tag: ["@TC-DOCUMENTS-058"] }, async ({ docLibraryPage, network }) => {
    await network.stubJson(docLibraryPage.listUrl("jd"), [], { method: "GET", delayMs: 3_000 });

    await docLibraryPage.goto("jd");

    await expect(docLibraryPage.heading("jd")).toBeVisible();
    await expect(docLibraryPage.anySubtitle()).toHaveCount(0);
    await expect(docLibraryPage.emptyMessage("jd")).toHaveCount(0);
    await expect(docLibraryPage.emptyMessage("jd")).toBeVisible({ timeout: 10_000 });
    await expect(docLibraryPage.subtitle(0)).toBeVisible();
  });

  test("tải danh sách lỗi thì hiện thông báo lỗi", { tag: ["@TC-DOCUMENTS-059"] }, async ({ docLibraryPage, network }) => {
    await network.failWith(docLibraryPage.listUrl("cv"), 500, { method: "GET" });

    await docLibraryPage.goto("cv");

    await expect(docLibraryPage.loadError()).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(docLibraryPage.anySubtitle()).toHaveCount(0);
    await expect(docLibraryPage.emptyMessage("cv")).toHaveCount(0);
  });

  test("trạng thái lỗi có nút thử lại tải lại danh sách", { tag: ["@TC-DOCUMENTS-060"] }, async ({ docLibraryPage, docOwner, network }) => {
    const doc = await docOwner.paste("CV");
    // initial request + react-query's 3 retries fail; the next one reaches the real backend
    await network.failWith(docLibraryPage.listUrl("cv"), 500, { method: "GET", times: 4 });

    await docLibraryPage.goto("cv");
    await expect(docLibraryPage.loadError()).toBeVisible({ timeout: LOAD_TIMEOUT });

    await docLibraryPage.retryButton().click({ timeout: 5_000 });
    await expect(docLibraryPage.row(doc.title)).toBeVisible();
    await expect(docLibraryPage.loadError()).toHaveCount(0);
  });

  test("giao diện tiếng Việt hiện đủ chuỗi tiếng Việt và không lộ raw key", { tag: ["@TC-DOCUMENTS-061"] }, async ({ docLibraryPage, docOwner }) => {
    const doc = await docOwner.paste("CV");

    await docLibraryPage.gotoLoaded("cv");
    await docLibraryPage.setLanguage("vi");

    await expect(docLibraryPage.heading("cv")).toHaveText(t("library.title.cv", "vi"));
    await expect(docLibraryPage.subtitle(1)).toBeVisible();
    await expect(docLibraryPage.formatBadge(doc.title, "text")).toHaveText(t("format.text", "vi"));
    const expected = new Intl.DateTimeFormat("vi").format(new Date(String(doc.createdAt)));
    await expect(docLibraryPage.dateText(doc.title)).toHaveText(expected);

    await docLibraryPage.openMenu(doc.title);
    expect(await docLibraryPage.menuLabels()).toEqual([
      t("library.action.preview", "vi"),
      t("library.action.rename", "vi"),
      t("library.action.setLineage", "vi"),
      t("library.action.delete", "vi"),
    ]);
    await docLibraryPage.menuItem("rename").click();
    await expect(docLibraryPage.rename.dialog()).toBeVisible();
    await expect(docLibraryPage.rename.input()).toHaveValue(doc.title);
    await expect(docLibraryPage.rename.saveButton()).toBeVisible();
    await expect(docLibraryPage.page.locator("body")).not.toContainText(/\b(library|preview|format|gate)\.[a-z]/);
  });

  test("menu, modal đổi tên dùng được bằng bàn phím và giữ focus trong modal", { tag: ["@TC-DOCUMENTS-062"] }, async ({ docLibraryPage, docOwner }) => {
    const doc = await docOwner.paste("JD");
    await docLibraryPage.gotoLoaded("jd");

    await docLibraryPage.actionsButton(doc.title).focus();
    await docLibraryPage.page.keyboard.press("Enter");
    await expect(docLibraryPage.menu()).toBeVisible();
    await docLibraryPage.page.keyboard.press("Escape");
    await expect(docLibraryPage.menu()).toHaveCount(0);

    await docLibraryPage.openRename(doc.title);
    for (let i = 0; i < 6; i += 1) {
      await docLibraryPage.page.keyboard.press("Tab");
      expect(await docLibraryPage.rename.holdsFocus(), `after ${i + 1} Tab`).toBe(true);
    }
    await docLibraryPage.page.keyboard.press("Escape");
    await expect(docLibraryPage.rename.dialog()).toHaveCount(0);
  });
});
