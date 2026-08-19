import { Client } from "pg";
import { expect, type Page } from "@playwright/test";

// Gate A of the §4.3 dual-gate for `ai-credentials`
// (docs/specs/ai-credentials/e2e.md). Self-contained: seeds credentials via the
// API and cleans them via `pg`, so the suite is deterministic and safe to
// re-run. Point E2E_BASE_URL / E2E_API_BASE / E2E_DATABASE_URL at the worktree
// ports when not on the defaults.

export const API_BASE =
  process.env.E2E_API_BASE ?? "http://localhost:5200/api/v1";

export const DB_URL =
  process.env.E2E_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/matchcv";

/** Long enough for the 20-char minimum, and recognisable in a leak assertion. */
export const VALID_KEY = "sk-e2e-playwright-secret-1234";

export interface SeededCredential {
  id: string;
  keyLast4: string;
}

export async function createCredential(body: {
  provider?: string;
  label: string;
  apiKey?: string;
  chatModel?: string;
  embedModel?: string;
}): Promise<SeededCredential> {
  const res = await fetch(`${API_BASE}/ai-credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: "openrouter",
      apiKey: VALID_KEY,
      ...body
    })
  });
  if (!res.ok) {
    throw new Error(`seed credential "${body.label}" failed: ${res.status}`);
  }
  return (await res.json()) as SeededCredential;
}

/**
 * Stamp lastUsedAt directly. Going through /match would need a real provider
 * call; the selector only reads the column, so setting it is equivalent and
 * keeps the suite offline.
 */
export async function markUsed(id: string, isoDate: string): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query(
      'UPDATE "AiCredential" SET "lastUsedAt" = $2 WHERE id = $1',
      [id, isoDate]
    );
  } finally {
    await client.end();
  }
}

/** Dev DB only. MatchResult.credentialId is ON DELETE SET NULL, so this is safe. */
export async function resetCredentials(): Promise<void> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    await client.query('DELETE FROM "AiCredential"');
  } finally {
    await client.end();
  }
}

/** Navigate to the credentials page and wait for client hydration. */
export async function gotoCredentials(page: Page): Promise<void> {
  await page.goto("/ai-credentials");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // `window.__i18n` is attached only after the client bundle runs, so its
  // presence is a reliable "React is hydrated & interactive" signal. Without
  // it, fast clicks land on SSR markup before handlers are wired.
  await page.waitForFunction(() => "__i18n" in window, undefined, {
    timeout: 15000
  });
}

/**
 * Open the Add dialog. Retried: under load the button can be clicked before
 * TanStack Start finishes hydrating, so the React handler is not wired yet and
 * the first click is a no-op (same hazard as switchToPasteTab in the wizard
 * helpers).
 */
export async function openAddDialog(
  page: Page,
  buttonName = "Add credential"
): Promise<void> {
  await expect(async () => {
    await page.getByRole("button", { name: buttonName }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
  // Locale-agnostic readiness check: the form is mounted. Asserting a specific
  // field label here would break the Vietnamese pass of the i18n spec.
  await expect(page.locator(".ant-form-item").first()).toBeVisible();
}

export async function fillCredentialForm(
  page: Page,
  values: { label?: string; apiKey?: string; chatModel?: string }
): Promise<void> {
  if (values.label !== undefined) {
    await page.getByLabel("Name").fill(values.label);
  }
  if (values.apiKey !== undefined) {
    await page.getByLabel("API key").fill(values.apiKey);
  }
  if (values.chatModel !== undefined) {
    await page.getByLabel("Chat model").fill(values.chatModel);
  }
}

/**
 * Route-stub `POST /ai-credentials/:id/test` so the suite never reaches a real
 * provider: the seeded keys are bogus, so without this the run depends on
 * OpenRouter being up just to receive a 401. Register BEFORE navigating.
 */
export async function stubTestEndpoint(
  page: Page,
  verdict: {
    status: string;
    chat: string;
    embed: string;
  } = { status: "ok", chat: "ok", embed: "ok" }
): Promise<void> {
  // Regex, not a glob: the id segment makes a `*` glob unreliable here.
  await page.route(/\/api\/v1\/ai-credentials\/[^/]+\/test$/, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...verdict, testedAt: new Date().toISOString() })
    });
  });
}

/** Switch the UI language through the dev-only i18n hook. */
export async function setLanguage(page: Page, lng: "en" | "vi"): Promise<void> {
  await page.evaluate(async (target) => {
    await (
      window as unknown as {
        __i18n: { changeLanguage: (l: string) => Promise<unknown> };
      }
    ).__i18n.changeLanguage(target);
  }, lng);
}
