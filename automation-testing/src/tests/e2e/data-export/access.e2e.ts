import { test, expect } from "@/fixtures";

// REQ-DATAEXPORT-02…04: who reaches /my-data. The app* projects run signed in as the seeded e2e user; anonymous and
// guest visitors get their own browser context (dataExportVisitor) with the same viewport as the project.

test.describe("/my-data — access", () => {
  test(
    "anonymous mở /my-data thấy màn mời đăng nhập, không gọi export",
    { tag: ["@TC-DATAEXPORT-034", "@smoke"] },
    async ({ dataExportVisitor }) => {
      const visitor = await dataExportVisitor("anonymous");
      const myData = visitor.myDataPage;

      await myData.goto();

      await expect(myData.gateHeading()).toBeVisible();
      await expect(myData.gateDescription()).toBeVisible();
      const href = await myData.gateSignInLink().getAttribute("href");
      const signIn = new URL(href ?? "", "http://placeholder");
      expect(signIn.pathname).toMatch(/\/auth\/login$/);
      expect(signIn.searchParams.get("returnTo")).toBe("/my-data");
      await expect(myData.gateBackLink()).toHaveAttribute("href", "/wizard");
      await expect(myData.anyDownloadButton()).toHaveCount(0);
      expect(visitor.exportRequests).toEqual([]);
    }
  );

  test(
    "khách mở /my-data thấy màn mời đăng nhập và quay về matching được",
    { tag: ["@TC-DATAEXPORT-035", "@creates-data"] },
    async ({ dataExportVisitor }) => {
      const visitor = await dataExportVisitor("guest");
      const myData = visitor.myDataPage;

      await myData.goto();

      await expect(myData.gateHeading()).toBeVisible();
      await expect(myData.gateDescription()).toBeVisible();
      await expect(myData.gateSignInLink()).toBeVisible();
      await expect(myData.anyDownloadButton()).toHaveCount(0);
      expect(visitor.exportRequests).toEqual([]);

      await myData.gateBackLink().click();
      await expect(visitor.page).toHaveURL(/\/wizard(\?|$)/);
    }
  );

  test(
    "khi /auth/me chưa trả lời trang hiện skeleton, không nháy màn đăng nhập",
    { tag: ["@TC-DATAEXPORT-036"] },
    async ({ page, myDataPage, dataExportNetwork }) => {
      const authMe = await dataExportNetwork.holdAuthMe(page);

      await myDataPage.goto();

      await expect(myDataPage.loadingSkeleton().first()).toBeVisible();
      await expect(myDataPage.gateHeading()).toHaveCount(0);
      await expect(myDataPage.anyDownloadButton()).toHaveCount(0);

      authMe.release();

      await expect(myDataPage.heading()).toBeVisible();
      await expect(myDataPage.downloadButton()).toBeEnabled();
      await expect(myDataPage.gateHeading()).toHaveCount(0);
    }
  );

  test(
    "user đăng nhập thấy mục My data trên sidebar và vào được trang",
    { tag: ["@TC-DATAEXPORT-037"] },
    async ({ page, myDataPage }) => {
      await myDataPage.openFrom("/");

      await myDataPage.shell.navigate("myData");

      await expect(page).toHaveURL(/\/my-data(\?|$)/);
      await expect(myDataPage.heading()).toBeVisible();
    }
  );

  // One test per visitor: each opens its own browser context and the mobile nav drawer, which together do not fit one
  // test timeout on the tablet/mobile projects.
  for (const who of ["anonymous", "guest"] as const) {
    test(
      `${who === "anonymous" ? "anonymous" : "khách"} không thấy mục My data trên sidebar`,
      { tag: ["@TC-DATAEXPORT-038", ...(who === "guest" ? ["@creates-data"] : [])] },
      async ({ dataExportVisitor }) => {
        const visitor = await dataExportVisitor(who);
        await visitor.myDataPage.openFrom("/");

        // Positive control: the nav is on screen for this visitor, it just does not offer My data.
        await expect(await visitor.myDataPage.navLink("home")).toBeVisible();
        await expect(await visitor.myDataPage.navLink("myData")).toHaveCount(0);
      }
    );
  }
});
