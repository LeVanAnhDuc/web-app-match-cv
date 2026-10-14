import { expect, test } from "@/fixtures";
import { CV_TEXT, JD_TEXT, MATCH_URL, matchResultStub, uniqueText } from "@/data/test-data/cv-jd-matching-wizard";

// The main journey US-01 end to end on the real backend, POST /match stubbed (D1), watching for console errors and
// 5xx responses on the way (REQ-53).

/**
 * Dev-build noise that says nothing about the wizard: antd/React warnings (e.g. the global
 * "[antd: App] When using cssVar…" warning, see decisions/ui-consistency-shell.md), also as the Vite dev server echoes
 * them back into the browser console prefixed "[Server]". Same list as cv-rewrite-assistant/quality.e2e.ts.
 */
const BENIGN_CONSOLE = [/^Warning:/, /\[antd:/, /React DevTools/];

test(
  "luồng chính dán JD, dán CV, review, chạy match tới kết quả không lỗi console hay 5xx",
  { tag: ["@TC-CVJDMATCHINGWIZARD-090", "@smoke"] },
  async ({ wizardPage, network, page }) => {
    const consoleErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !BENIGN_CONSOLE.some((re) => re.test(msg.text()))) consoleErrors.push(msg.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`);
    });
    const result = matchResultStub();
    await network.stubJson(MATCH_URL, result, { method: "POST", status: 201 });
    const jd = uniqueText(JD_TEXT);
    const cv = uniqueText(CV_TEXT);

    await wizardPage.goto();
    await wizardPage.advanceToReview(jd, cv);
    await wizardPage.runMatch();

    await expect(wizardPage.scoreMeter("overall")).toHaveAttribute("aria-valuenow", String(result.overallScore));
    await expect(wizardPage.reportItem(result.report.strengths[0])).toBeVisible();
    expect(consoleErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
  }
);
