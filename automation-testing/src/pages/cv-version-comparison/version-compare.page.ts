import type { Locator } from "@playwright/test";
import { t } from "@/data/copy";
import { BasePage } from "../base.page";

export type ScoreKind = "overall" | "semantic" | "keyword";
export type GapBucket = "closed" | "persisted" | "introduced";

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// /compare/$documentId?jd= (client/src/views/CvComparison/**). The <h1> is rendered outside the report, so it is on
// screen in every state (loading, error, empty, report) except the sign-in gate of an anonymous visitor.
export class VersionComparePage extends BasePage {
  /** Opens `/compare/<documentId>[?jd=<jd>]` and waits for hydration. */
  async goto(documentId: string, jd?: string): Promise<void> {
    await this.page.goto(`/compare/${documentId}${jd ? `?jd=${encodeURIComponent(jd)}` : ""}`);
    await this.waitForAppReady();
  }

  // ── header ───────────────────────────────────────────────────────────────
  heading(): Locator {
    return this.page.getByRole("heading", { level: 1, name: t("compare.title", this.lng) });
  }

  subtitle(): Locator {
    return this.page.getByText(t("compare.subtitle", this.lng), { exact: true });
  }

  /** "Version <n>" in the report card's title. */
  versionLabel(n: number): Locator {
    return this.page.getByText(t("compare.version", this.lng, { n }), { exact: true });
  }

  /** Any "Version <n>" label. */
  anyVersionLabel(): Locator {
    return this.page.getByText(new RegExp(`^${escapeRegExp(t("compare.version", this.lng, { n: 999 })).replace("999", "\\d+")}$`));
  }

  /** The card description "<base title> → <revision title>". */
  titlesLine(baseTitle: string, revisionTitle: string): Locator {
    return this.page.getByText(`${baseTitle} → ${revisionTitle}`, { exact: true });
  }

  /** The route's sign-in gate (anonymous / guest). */
  signInGate(): Locator {
    return this.page.getByRole("heading", { name: t("gate.compare", this.lng) });
  }

  // ── job description selector ─────────────────────────────────────────────
  jdSelect(): Locator {
    return this.page.getByRole("combobox", { name: t("compare.jdLabel", this.lng) });
  }

  /** The rendered value (or an open option) carrying `title`. antd renders both with a `title` attribute. */
  jdTitle(title: string): Locator {
    return this.page.getByTitle(title, { exact: true });
  }

  /** Opens the JD dropdown from the keyboard (focus + ArrowDown), which keeps every actionability check. */
  async openJdSelect(): Promise<void> {
    await this.jdSelect().focus();
    await this.page.keyboard.press("ArrowDown");
    // rc-select forwards arrow / Enter keys to the option list only once it is mounted; a key sent earlier is dropped.
    const listId = await this.jdSelect().getAttribute("aria-controls");
    await this.page.locator(`[id="${listId}"]`).waitFor({ state: "attached" });
  }

  /** Picks a job description by its title. The option is the last element carrying the title (the popup is portaled). */
  async chooseJd(title: string): Promise<void> {
    await this.openJdSelect();
    await this.jdTitle(title).last().click();
  }

  // ── scores ───────────────────────────────────────────────────────────────
  /** The Readout block of one score: label, new score, delta, meter. */
  scoreBlock(kind: ScoreKind): Locator {
    return this.page
      .getByText(t(`result.${kind}`, this.lng), { exact: true })
      .locator("xpath=..");
  }

  /** The 0–100 meter of one score (role="meter", aria-valuenow = new score). */
  meter(kind: ScoreKind): Locator {
    return this.page.getByRole("meter", { name: t(`result.${kind}`, this.lng) });
  }

  /** Every meter on the page. */
  meters(): Locator {
    return this.page.getByRole("meter");
  }

  /** The signed delta numbers, in Overall / Semantic / Keyword order. */
  deltaValues(): Locator {
    return this.page.getByTestId("delta-value");
  }

  /** The delta of one block. */
  deltaValue(kind: ScoreKind): Locator {
    return this.scoreBlock(kind).getByTestId("delta-value");
  }

  /** Screen-reader direction text ("better than the previous version"…). */
  deltaDirection(direction: "up" | "down" | "flat"): Locator {
    return this.page.getByText(t(`compare.delta.${direction}`, this.lng), { exact: true });
  }

  notComparable(): Locator {
    return this.page.getByText(t("readout.notComparable", this.lng), { exact: true });
  }

  // ── alerts ───────────────────────────────────────────────────────────────
  modelWarning(): Locator {
    return this.page.getByRole("alert").filter({ hasText: t("compare.modelWarning.title", this.lng) });
  }

  missingAlert(side: "base" | "revision"): Locator {
    return this.page.getByRole("alert").filter({ hasText: t(`compare.missing.${side}`, this.lng) });
  }

  missingHint(): Locator {
    return this.page.getByText(t("compare.missing.hint", this.lng), { exact: true });
  }

  matchThisVersionButton(): Locator {
    return this.page.getByRole("button", { name: t("compare.missing.cta", this.lng) });
  }

  emptyState(): Locator {
    return this.page.getByRole("alert").filter({ hasText: t("compare.empty.title", this.lng) });
  }

  emptyHint(): Locator {
    return this.page.getByText(t("compare.empty.hint", this.lng), { exact: true });
  }

  goToWizardButton(): Locator {
    return this.page.getByRole("button", { name: t("compare.empty.cta", this.lng) });
  }

  // ── gaps ─────────────────────────────────────────────────────────────────
  gapsTitle(): Locator {
    return this.page.getByText(t("compare.gaps.title", this.lng), { exact: true });
  }

  gapsCaveat(): Locator {
    return this.page.getByText(t("compare.gaps.caveat", this.lng), { exact: true });
  }

  /** The bucket heading, e.g. "Closed (2)"; with `count`, only when it shows that count. */
  gapHeading(bucket: GapBucket, count?: number): Locator {
    const name = escapeRegExp(t(`compare.gaps.${bucket}`, this.lng));
    const n = count === undefined ? "\\d+" : String(count);
    return this.page.getByRole("heading", { name: new RegExp(`^${name}\\s*\\(${n}\\)$`) });
  }

  /** The list of a non-empty bucket (accessible name = bucket name). */
  gapList(bucket: GapBucket): Locator {
    return this.page.getByRole("list", { name: t(`compare.gaps.${bucket}`, this.lng), exact: true });
  }

  /** The "None" placeholder of empty buckets. */
  gapNone(): Locator {
    return this.page.getByText(t("compare.gaps.none", this.lng), { exact: true });
  }

  // ── error / loading ──────────────────────────────────────────────────────
  /** The load-error message (a <p role="alert"> inside the page). */
  errorMessage(): Locator {
    return this.page.getByRole("main").getByRole("alert");
  }

  backToLibraryButton(): Locator {
    return this.page.getByRole("button", { name: t("compare.backToLibrary", this.lng) });
  }

  /** The loading skeleton's wrapper. */
  busyRegion(): Locator {
    return this.page.locator('[aria-busy="true"]');
  }

  /** The polite live region around the score / missing-state area. */
  liveRegion(): Locator {
    return this.page.locator('[aria-live="polite"]');
  }

  // ── page-level probes ────────────────────────────────────────────────────
  /** <script> elements whose text contains `marker` (an injected script would show up here). */
  scriptsContaining(marker: string): Locator {
    return this.page.locator("script", { hasText: marker });
  }

  /** Whether a window global set by injected markup exists. */
  async windowHas(name: string): Promise<boolean> {
    return this.page.evaluate((key) => key in window, name);
  }

  /** The serialized DOM, to prove a value never reached the page. */
  async html(): Promise<string> {
    return this.page.content();
  }
}
