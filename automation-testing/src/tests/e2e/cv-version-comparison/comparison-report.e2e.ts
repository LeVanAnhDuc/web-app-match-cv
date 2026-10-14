import { GAPS, HOSTILE_GAP, HOSTILE_TITLE, MODELS } from "@/data/test-data/cv-version-comparison";
import { expect, test } from "@/fixtures";

// What /compare/<id> shows for each shape of comparison (REQ-CVVERSIONCOMPARISON-10/13/15/16/17/18/19/21). All rows
// are seeded live (decision Q1 = a); the page reads them through the real GET /comparisons.

test.describe("cv-version-comparison — comparison report", () => {
  test(
    "trang so sánh có tiêu đề, phụ đề, Version 1 → Version 2 và tên hai bản",
    { tag: ["@TC-CVVERSIONCOMPARISON-037", "@smoke"] },
    async ({ versionComparePage, cvcSeed }) => {
      const { v2, titles } = await cvcSeed.happyPair();

      await versionComparePage.goto(v2);

      await expect(versionComparePage.heading()).toBeVisible();
      await expect(versionComparePage.subtitle()).toBeVisible();
      await expect(versionComparePage.versionLabel(1)).toBeVisible();
      await expect(versionComparePage.versionLabel(2)).toBeVisible();
      await expect(versionComparePage.titlesLine(titles.v1, titles.v2)).toBeVisible();
    }
  );

  test(
    "mỗi khối điểm hiện điểm bản mới, thanh meter và delta có dấu đọc được",
    { tag: ["@TC-CVVERSIONCOMPARISON-038", "@smoke"] },
    async ({ versionComparePage, cvcSeed }) => {
      const { v2 } = await cvcSeed.happyPair();

      await versionComparePage.goto(v2);

      const expected = { overall: [75, "+14"], semantic: [78, "+8"], keyword: [71, "+23"] } as const;
      for (const [kind, [score, delta]] of Object.entries(expected) as Array<[keyof typeof expected, readonly [number, string]]>) {
        await expect(versionComparePage.scoreBlock(kind)).toContainText(`${score}%`);
        await expect(versionComparePage.meter(kind)).toHaveAttribute("aria-valuenow", String(score));
        await expect(versionComparePage.deltaValue(kind)).toHaveText(delta);
      }
      // The old version's score is not on this screen (decision Q2 = a).
      await expect(versionComparePage.scoreBlock("overall")).not.toContainText("61");
      // Direction is spelled out for a screen reader, not carried by colour alone.
      await expect(versionComparePage.deltaDirection("up")).toHaveCount(3);
    }
  );

  test(
    "delta âm in dấu trừ, delta 0 không có dấu cộng",
    { tag: ["@TC-CVVERSIONCOMPARISON-039"] },
    async ({ versionComparePage, cvcSeed }) => {
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv({ parentId: v1 });
      const jd = await cvcSeed.jd();
      await cvcSeed.match(v1, jd, { scores: [70, 50, 50] });
      await cvcSeed.match(v2, jd, { scores: [64, 50, 51] });

      await versionComparePage.goto(v2);

      await expect(versionComparePage.deltaValues()).toHaveText(["-6", "0", "+1"]);
      await expect(versionComparePage.deltaDirection("down")).toHaveCount(1);
      await expect(versionComparePage.deltaDirection("flat")).toHaveCount(1);
      await expect(versionComparePage.deltaDirection("up")).toHaveCount(1);
    }
  );

  test(
    "delta biên +100 và -100 hiển thị trọn trong khối",
    { tag: ["@TC-CVVERSIONCOMPARISON-040"] },
    async ({ versionComparePage, cvcSeed, page }) => {
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv({ parentId: v1 });
      const jd = await cvcSeed.jd();
      await cvcSeed.match(v1, jd, { scores: [0, 100, 50] });
      await cvcSeed.match(v2, jd, { scores: [100, 0, 50] });

      await versionComparePage.goto(v2);

      await expect(versionComparePage.deltaValues()).toHaveText(["+100", "-100", "0"]);
      await expect(versionComparePage.meter("overall")).toHaveAttribute("aria-valuenow", "100");
      await expect(versionComparePage.meter("semantic")).toHaveAttribute("aria-valuenow", "0");
      const width = page.viewportSize()!.width;
      for (const kind of ["overall", "semantic", "keyword"] as const) {
        const box = await versionComparePage.scoreBlock(kind).boundingBox();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(width);
      }
    }
  );

  test(
    "gap được chia ba nhóm có số đếm, giữ nguyên văn, nhóm còn tồn tại hiện cả hai câu",
    { tag: ["@TC-CVVERSIONCOMPARISON-041", "@smoke"] },
    async ({ versionComparePage, cvcSeed }) => {
      const { v2 } = await cvcSeed.happyPair();

      await versionComparePage.goto(v2);

      await expect(versionComparePage.gapsTitle()).toBeVisible();
      // It never claims to be exact.
      await expect(versionComparePage.gapsCaveat()).toBeVisible();
      for (const bucket of ["closed", "persisted", "introduced"] as const) {
        await expect(versionComparePage.gapHeading(bucket, 1)).toBeVisible();
      }
      await expect(versionComparePage.gapList("closed")).toContainText(GAPS.closed);
      await expect(versionComparePage.gapList("introduced")).toContainText(GAPS.introduced);
      const stillOpen = versionComparePage.gapList("persisted");
      await expect(stillOpen).toContainText(GAPS.reworded.base);
      await expect(stillOpen).toContainText(GAPS.reworded.revision);
      await expect(stillOpen).not.toContainText("[object Object]");
    }
  );

  test(
    "nhóm gap rỗng ghi rõ là không có",
    { tag: ["@TC-CVVERSIONCOMPARISON-042"] },
    async ({ versionComparePage, cvcSeed }) => {
      const { v2 } = await cvcSeed.happyPair({ base: [], revision: [] });

      await versionComparePage.goto(v2);

      await expect(versionComparePage.gapNone()).toHaveCount(3);
      for (const bucket of ["closed", "persisted", "introduced"] as const) {
        await expect(versionComparePage.gapHeading(bucket, 0)).toBeVisible();
      }
    }
  );

  test(
    "hai lần match khác model bị cảnh báo và delta ghi không so được",
    { tag: ["@TC-CVVERSIONCOMPARISON-043"] },
    async ({ versionComparePage, cvcSeed }) => {
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv({ parentId: v1 });
      const jd = await cvcSeed.jd();
      await cvcSeed.match(v1, jd, { scores: [60, 60, 60], chatModel: MODELS.chat });
      await cvcSeed.match(v2, jd, { scores: [70, 70, 70], chatModel: MODELS.otherChat });

      await versionComparePage.goto(v2);

      await expect(versionComparePage.modelWarning()).toBeVisible();
      await expect(versionComparePage.modelWarning()).toContainText(MODELS.chat);
      await expect(versionComparePage.modelWarning()).toContainText(MODELS.otherChat);
      await expect(versionComparePage.notComparable()).toHaveCount(3);
      await expect(versionComparePage.deltaValues()).toHaveCount(0);
    }
  );

  test(
    "chỉ khác embedding model thì cảnh báo nêu đúng hai embedding model",
    { tag: ["@TC-CVVERSIONCOMPARISON-044"] },
    async ({ versionComparePage, cvcSeed }) => {
      // BUG: defects/cv-version-comparison.md#bug-cvversioncomparison-01
      test.fail();
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv({ parentId: v1 });
      const jd = await cvcSeed.jd();
      await cvcSeed.match(v1, jd, { embedModel: MODELS.embed });
      await cvcSeed.match(v2, jd, { embedModel: MODELS.otherEmbed });

      await versionComparePage.goto(v2);

      await expect(versionComparePage.modelWarning()).toBeVisible();
      await expect(versionComparePage.notComparable()).toHaveCount(3);
      await expect(versionComparePage.modelWarning()).toContainText(MODELS.embed);
      await expect(versionComparePage.modelWarning()).toContainText(MODELS.otherEmbed);
    }
  );

  test(
    "phiên bản chưa match có lời mời match, không có ô điểm nào",
    { tag: ["@TC-CVVERSIONCOMPARISON-045"] },
    async ({ versionComparePage, cvcSeed }) => {
      // The new version was never matched.
      const a1 = await cvcSeed.cv();
      const a2 = await cvcSeed.cv({ parentId: a1 });
      const jd = await cvcSeed.jd();
      await cvcSeed.match(a1, jd);

      await versionComparePage.goto(a2);
      await expect(versionComparePage.missingAlert("revision")).toBeVisible();
      await expect(versionComparePage.missingHint()).toBeVisible();
      await expect(versionComparePage.matchThisVersionButton()).toBeVisible();
      await expect(versionComparePage.meters()).toHaveCount(0);
      await expect(versionComparePage.deltaValues()).toHaveCount(0);

      // The earlier version was never matched.
      const b1 = await cvcSeed.cv();
      const b2 = await cvcSeed.cv({ parentId: b1 });
      await cvcSeed.match(b2, jd);

      await versionComparePage.goto(b2);
      await expect(versionComparePage.missingAlert("base")).toBeVisible();
      await expect(versionComparePage.matchThisVersionButton()).toBeVisible();
      await expect(versionComparePage.meters()).toHaveCount(0);
    }
  );

  test(
    "nút Match this version mở wizard ở bước Review với đúng CV và JD, không tự chạy match",
    { tag: ["@TC-CVVERSIONCOMPARISON-046"] },
    async ({ versionComparePage, versionWizardPage, cvcSeed, network, page }) => {
      const matches = network.recordRequests(/\/api\/v1\/match(\/|\?|$)/, { method: "POST" });
      await network.failWith("**/api/v1/match", 500, { method: "POST" });
      const v1Text = `v1-text-${cvcSeed.title("x").replace(/\W/g, "")}`;
      const v2Text = `v2-text-${cvcSeed.title("y").replace(/\W/g, "")}`;
      const jdText = `jd-text-${cvcSeed.title("z").replace(/\W/g, "")}`;
      const v1 = await cvcSeed.cv({ text: v1Text });
      const v2 = await cvcSeed.cv({ text: v2Text, parentId: v1 });
      const jd = await cvcSeed.jd({ text: jdText });
      await cvcSeed.match(v1, jd);

      await versionComparePage.goto(v2);
      await versionComparePage.matchThisVersionButton().click();

      await expect(page).toHaveURL(/\/wizard$/);
      await expect(versionWizardPage.reviewTitle()).toBeVisible();
      await expect(versionWizardPage.runMatchButton()).toBeVisible();
      await expect(versionWizardPage.previewText(v2Text)).toBeVisible();
      await expect(versionWizardPage.previewText(jdText)).toBeVisible();
      expect(matches).toEqual([]);
    }
  );

  test(
    "chưa phiên bản nào được match thì có trạng thái rỗng dẫn tới wizard",
    { tag: ["@TC-CVVERSIONCOMPARISON-047"] },
    async ({ versionComparePage, cvcSeed, page }) => {
      const v1 = await cvcSeed.cv();
      const v2 = await cvcSeed.cv({ parentId: v1 });

      await versionComparePage.goto(v2);

      await expect(versionComparePage.emptyState()).toBeVisible();
      await expect(versionComparePage.emptyHint()).toBeVisible();
      await expect(versionComparePage.jdSelect()).toHaveCount(0);
      await expect(versionComparePage.meters()).toHaveCount(0);
      await versionComparePage.goToWizardButton().click();
      await expect(page).toHaveURL(/\/wizard$/);
    }
  );

  test(
    "chuỗi ba thế hệ hiển thị Version 2 → Version 3",
    { tag: ["@TC-CVVERSIONCOMPARISON-048"] },
    async ({ versionComparePage, cvcSeed }) => {
      const [, v2, v3] = await cvcSeed.chain(3);
      const jd = await cvcSeed.jd();
      await cvcSeed.match(v2, jd);
      await cvcSeed.match(v3, jd);

      await versionComparePage.goto(v3);

      await expect(versionComparePage.versionLabel(2)).toBeVisible();
      await expect(versionComparePage.versionLabel(3)).toBeVisible();
      await expect(versionComparePage.versionLabel(1)).toHaveCount(0);
    }
  );

  test(
    "markup trong gap và tiêu đề hiện dạng chữ, raw text không lên trang",
    { tag: ["@TC-CVVERSIONCOMPARISON-049", "@smoke"] },
    async ({ versionComparePage, cvcSeed }) => {
      const baseTitle = `${HOSTILE_TITLE} ${cvcSeed.title("v1")}`;
      const revisionTitle = cvcSeed.title("Plain v2");
      const v1Text = `secret-cv-one-${Date.now()}`;
      const v2Text = `secret-cv-two-${Date.now()}`;
      const v1 = await cvcSeed.cv({ title: baseTitle, text: v1Text });
      const v2 = await cvcSeed.cv({ title: revisionTitle, text: v2Text, parentId: v1 });
      const jd = await cvcSeed.jd();
      await cvcSeed.match(v1, jd, { gaps: [HOSTILE_GAP] });
      await cvcSeed.match(v2, jd, { gaps: [HOSTILE_GAP] });

      await versionComparePage.goto(v2);

      await expect(versionComparePage.titlesLine(baseTitle, revisionTitle)).toBeVisible();
      await expect(versionComparePage.gapList("persisted").getByText(HOSTILE_GAP).first()).toBeVisible();
      await expect(versionComparePage.scriptsContaining("__cvcPwned")).toHaveCount(0);
      expect(await versionComparePage.windowHas("__cvcPwned")).toBe(false);
      const html = await versionComparePage.html();
      expect(html).not.toContain(v1Text);
      expect(html).not.toContain(v2Text);
    }
  );
});
