import { test, expect } from "@/fixtures";

// /cv and /jd behind RequireAuth (REQ-DOCUMENTS-21): anonymous visitors and guests get the SignInGate and the page
// never asks for the list. Runs on desktop / tablet / mobile; the tab's cookie is replaced per test (docSignInAs).

test.describe("Cổng đăng nhập của thư viện", { tag: ["@creates-data"] }, () => {
  test("người chưa đăng nhập mở /cv thấy cổng đăng nhập và không gọi API danh sách", { tag: ["@TC-DOCUMENTS-050", "@smoke"] }, async ({ docLibraryPage, docSignInAs, network, urls }) => {
    await docSignInAs("anonymous");
    const listCalls = network.recordRequests(docLibraryPage.listUrl("cv"));

    await docLibraryPage.goto("cv");

    await expect(docLibraryPage.gateTitle("cv")).toBeVisible();
    await expect(docLibraryPage.gateDescription()).toBeVisible();
    await expect(docLibraryPage.gateSignInLink()).toHaveAttribute(
      "href",
      `${urls.apiUrl}/auth/login?returnTo=${encodeURIComponent("/cv")}`
    );
    await expect(docLibraryPage.heading("cv")).toHaveCount(0);
    expect(listCalls).toHaveLength(0);

    await docLibraryPage.gateBackLink().click();
    await expect(docLibraryPage.page).toHaveURL(/\/wizard$/);
  });

  test("khách mở /jd thấy cổng đăng nhập của JD", { tag: ["@TC-DOCUMENTS-051"] }, async ({ docLibraryPage, docSignInAs, network, urls }) => {
    await docSignInAs("guest");
    const listCalls = network.recordRequests(docLibraryPage.listUrl("jd"));

    await docLibraryPage.goto("jd");

    await expect(docLibraryPage.gateTitle("jd")).toBeVisible();
    await expect(docLibraryPage.gateSignInLink()).toHaveAttribute(
      "href",
      `${urls.apiUrl}/auth/login?returnTo=${encodeURIComponent("/jd")}`
    );
    await expect(docLibraryPage.gateBackLink()).toHaveAttribute("href", "/wizard");
    expect(listCalls).toHaveLength(0);
  });
});
