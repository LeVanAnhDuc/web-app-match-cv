import type { ApiClient } from "@/api";
import { WizardPage } from "@/pages/cv-jd-matching-wizard/wizard.page";
import { createSignedInUser, deleteUsers, resolveSession, SESSION_COOKIE, type SeededUser } from "@/utils/sessions";
import { test as shared } from "../shared.fixture";

// Fixture slot of module "cv-jd-matching-wizard" — owned by that module: its page objects, seeded data, AI stubs.
// Add fixtures here, never in the shared files; this slot is already merged in fixtures/index.ts.
// Fixture names must be unique across ALL modules (mergeTests merges them into one test): prefix generic names.
//
//   wizardUser       a fresh signed-in user for THIS test, its session cookie planted in the page's context (replacing
//                    the seeded e2e user's). Saved-document lists, AI keys and runs start empty, so a wizard spec never
//                    depends on what other modules left on the shared e2e user. Deleted afterwards (cascade).
//   wizardPage       WizardPage signed in as wizardUser
//   wizardApi        ApiClient as wizardUser (seed saved documents, runs…)
//   guestWizardPage  WizardPage with no cookie at all (anonymous); the guest its first POST /documents mints is
//                    deleted afterwards

export const test = shared.extend<{
  wizardUser: SeededUser;
  wizardPage: WizardPage;
  wizardApi: ApiClient;
  guestWizardPage: WizardPage;
}>({
  wizardUser: async ({ page, urls }, use) => {
    const user = await createSignedInUser();
    const token = user.cookie.slice(`${SESSION_COOKIE}=`.length);
    const context = page.context();
    await context.clearCookies();
    await context.addCookies([
      {
        name: SESSION_COOKIE,
        value: token,
        domain: new URL(urls.webUrl).hostname,
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    await use(user);
    await deleteUsers([user.userId]);
  },

  wizardPage: async ({ page, wizardUser }, use) => {
    void wizardUser;
    await use(new WizardPage(page));
  },

  wizardApi: async ({ apiAs, wizardUser }, use) => {
    await use(apiAs(wizardUser));
  },

  guestWizardPage: async ({ page }, use) => {
    const context = page.context();
    await context.clearCookies();
    await use(new WizardPage(page));
    const session = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
    if (!session) return;
    const owner = await resolveSession(session.value);
    if (owner?.isGuest) await deleteUsers([owner.userId]);
  },
});
