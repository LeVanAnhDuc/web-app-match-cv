import { randomUUID } from "node:crypto";

// Values of module "ui-consistency-shell" (app shell, sidebar, layout primitive). Text comes from t(), not from here.

/** localStorage key the shell persists the desktop sidebar state under (client/src/stores/slices/ui.ts). */
export const SIDEBAR_STORAGE_KEY = "ui.sidebarCollapsed";

/** Every /_app route the shell must wrap. Dynamic segments get an id that does not exist: the page renders its own
 *  not-found/error state, which is still inside the shell. */
export function appRoutes(): string[] {
  return ["/", "/wizard", "/cv", "/jd", "/ai-credentials", "/my-data", `/compare/${randomUUID()}`, `/cv-rewrite/${randomUUID()}`];
}

/** Static routes (no id) — the ones a horizontal-scroll / padding sweep visits. */
export const STATIC_ROUTES = ["/", "/wizard", "/cv", "/jd", "/ai-credentials", "/my-data"] as const;

/** Persisted values and the state each must produce (REQ-07): only "true" / "false" are honoured. */
export const PERSISTED_VALUES: ReadonlyArray<{ value: string | null; collapsed: boolean }> = [
  { value: "true", collapsed: true },
  { value: "false", collapsed: false },
  { value: "", collapsed: false },
  { value: "maybe", collapsed: false },
  { value: "TRUE", collapsed: false },
  { value: null, collapsed: false },
];

/** Shell geometry (design §3 / §4.4). */
export const SHELL_SIZE = {
  expandedSidebar: 288,
  rail: 64,
  /** Minimum hit area of shell controls (NFR-A11Y-03). */
  hitArea: 44,
  pageMaxWidth: 1600,
  paddingBelowMd: 16,
  paddingFromMd: 24,
  mdBreakpoint: 768,
  lgBreakpoint: 1024,
  narrowPhone: 375,
} as const;

/** BVA around the lg breakpoint (REQ-10). */
export const LG_BOUNDARY = [
  { width: 1023, compact: true },
  { width: 1024, compact: false },
  { width: 1025, compact: false },
] as const;

/** Typography / shape of SectionCard and page headings (REQ-16), in computed CSS px. */
export const SECTION_CARD_STYLE = {
  radius: "12px",
  h2FontSize: "20px",
  h1FontSize: "24px",
  eyebrowFontSize: "12px",
  minBoldWeight: 700,
} as const;

/** --color-surface in light and dark (client/src/styles.css). */
export const SURFACE_COLOR = {
  light: "rgb(255, 255, 255)",
  dark: "rgb(24, 24, 27)",
} as const;

/** Labels the feature removed (REQ-04). Case-sensitive on purpose: "No saved CVs yet" (empty-state copy) is not one. */
export const LEGACY_LABELS = /Saved CVs|Saved JDs/;

/** A raw i18n key leaking into the shell instead of its translation (REQ-18). */
export const RAW_KEY = /\b(?:nav|auth|appName)\.[a-zA-Z.]+\b/;

/** Console text that marks a React hydration mismatch (REQ-08). */
export const HYDRATION_ERROR = /hydrat|did not match|server rendered HTML/i;

/** Guest quota used beyond its limit (REQ-14 clamp): left must show 0, never negative. */
export const OVERDRAWN_QUOTA = { limit: 5, used: 7 } as const;

/** How long the library may take to show its load error: react-query retries a failed list 3x with back-off (~7s). */
export const LIBRARY_ERROR_TIMEOUT = 20_000;
