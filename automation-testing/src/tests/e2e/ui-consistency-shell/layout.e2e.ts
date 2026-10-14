import { test, expect } from "@/fixtures";
import {
  LIBRARY_ERROR_TIMEOUT,
  SECTION_CARD_STYLE,
  SHELL_SIZE,
  STATIC_ROUTES,
  SURFACE_COLOR,
} from "@/data/test-data/ui-consistency-shell";

// Layout primitives every page shares (REQ-UICONSISTENCYSHELL-15..17): PageContainer, SectionCard, headings, and the
// library's empty / error states inside the new layout.

test.describe("signed-in user", () => {
  test("Mọi trang bọc trong PageContainer 1600px với padding theo bề rộng", { tag: ["@TC-UICONSISTENCYSHELL-028"] }, async ({
    shellLayoutPage,
    page,
  }) => {
    const width = page.viewportSize()?.width ?? 0;
    const padding = `${width < SHELL_SIZE.mdBreakpoint ? SHELL_SIZE.paddingBelowMd : SHELL_SIZE.paddingFromMd}px`;
    for (const path of STATIC_ROUTES) {
      await shellLayoutPage.goto(path);
      await expect(shellLayoutPage.pageContainer(), path).toBeVisible();
      expect(await shellLayoutPage.pageContainerStyle(), path).toEqual({
        maxWidth: `${SHELL_SIZE.pageMaxWidth}px`,
        paddingLeft: padding,
        paddingRight: padding,
      });
    }
  });

  test("Không trang nào cuộn ngang ở bề rộng 375px", { tag: ["@TC-UICONSISTENCYSHELL-029"] }, async ({
    shellLayoutPage,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "app-mobile", "sets a 375px viewport itself; the mobile project is the closest");
    await shellLayoutPage.resize(SHELL_SIZE.narrowPhone, 800);
    for (const path of STATIC_ROUTES) {
      await shellLayoutPage.goto(path);
      await expect(shellLayoutPage.pageContainer(), path).toBeVisible();
      expect(await shellLayoutPage.horizontalOverflow(), path).toBe(0);
    }
  });

  test("Màu SectionCard theo prefers-color-scheme sáng và tối", { tag: ["@TC-UICONSISTENCYSHELL-031"] }, async ({
    shellLayoutPage,
  }) => {
    // /my-data always renders a titled SectionCard (the library only has one once documents exist, and it is untitled).
    await shellLayoutPage.goto("/my-data");
    const heading = shellLayoutPage.sectionHeadings().first();
    await expect(heading).toBeVisible();

    await shellLayoutPage.emulateColorScheme("light");
    expect((await shellLayoutPage.cardStyleAround(heading)).background).toBe(SURFACE_COLOR.light);
    await shellLayoutPage.emulateColorScheme("dark");
    expect((await shellLayoutPage.cardStyleAround(heading)).background).toBe(SURFACE_COLOR.dark);
  });

  test("Thư viện trống hiện empty state bên trong layout", { tag: ["@TC-UICONSISTENCYSHELL-032", "@creates-data"] }, async ({
    ucsFreshUser,
    shellLayoutPage,
  }) => {
    expect(ucsFreshUser.userId).toBeTruthy();
    for (const kind of ["cv", "jd"] as const) {
      await shellLayoutPage.goto(`/${kind}`);
      await expect(shellLayoutPage.libraryEmpty(kind), kind).toBeVisible();
      await expect(shellLayoutPage.pageContainer(), kind).toContainText(shellLayoutPage.libraryEmptyText(kind));
    }
  });

  test("Lỗi tải thư viện hiện thông báo bên trong layout", { tag: ["@TC-UICONSISTENCYSHELL-033"] }, async ({
    shellLayoutPage,
    network,
  }) => {
    // Q5: the real backend cannot be made to fail on demand, so only the library's list read is forced to 500.
    await network.failWith(/\/api\/v1\/documents\?/, 500, { method: "GET" });
    for (const path of ["/cv", "/jd"]) {
      await shellLayoutPage.goto(path);
      // react-query retries the failed list 3x with back-off before it shows the error state.
      await expect(shellLayoutPage.libraryLoadError(), path).toBeVisible({ timeout: LIBRARY_ERROR_TIMEOUT });
      await expect(shellLayoutPage.pageContainer().getByRole("alert"), path).toBeVisible();
      await expect(shellLayoutPage.shell.main(), path).toBeVisible();
    }
  });
});

test.describe("anonymous visitor", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("SectionCard và tiêu đề trang dùng đúng cỡ chữ, bo góc và viền", { tag: ["@TC-UICONSISTENCYSHELL-030"] }, async ({
    shellLayoutPage,
  }) => {
    // Anonymous Home has all three: the page h1 (HeroCta), SectionCard h2 titles and an eyebrow (AccountPerks).
    await shellLayoutPage.goto("/");
    const h1 = shellLayoutPage.pageHeading();
    const h2 = shellLayoutPage.sectionHeadings().first();
    const eyebrow = shellLayoutPage.eyebrow("home.perks.eyebrow");
    await expect(h1).toBeVisible();
    await expect(h2).toBeVisible();
    await expect(eyebrow).toBeVisible();

    const h1Style = await shellLayoutPage.textStyle(h1);
    expect(h1Style.fontSize).toBe(SECTION_CARD_STYLE.h1FontSize);
    expect(h1Style.fontWeight).toBeGreaterThanOrEqual(SECTION_CARD_STYLE.minBoldWeight);

    const h2Style = await shellLayoutPage.textStyle(h2);
    expect(h2Style.fontSize).toBe(SECTION_CARD_STYLE.h2FontSize);
    expect(h2Style.fontWeight).toBeGreaterThanOrEqual(SECTION_CARD_STYLE.minBoldWeight);

    const eyebrowStyle = await shellLayoutPage.textStyle(eyebrow);
    expect(eyebrowStyle.fontSize).toBe(SECTION_CARD_STYLE.eyebrowFontSize);
    expect(eyebrowStyle.textTransform).toBe("uppercase");

    const card = await shellLayoutPage.cardStyleAround(h2);
    expect(card.radius).toBe(SECTION_CARD_STYLE.radius);
    expect(parseFloat(card.borderWidth)).toBeGreaterThan(0);
  });
});
