import { ShellLayoutPage } from "@/pages/ui-consistency-shell/shell-layout.page";
import { createSignedInUser, deleteUsers, SESSION_COOKIE, type SeededUser } from "@/utils/sessions";
import { test as shared } from "../shared.fixture";

// Fixture slot of module "ui-consistency-shell" — owned by that module: its page objects, seeded data, AI stubs.
// Add fixtures here, never in the shared files; this slot is already merged in fixtures/index.ts.
// Fixture names must be unique across ALL modules (mergeTests merges them into one test): prefix generic names.
//   shellLayoutPage   ShellLayoutPage on the test's page (sidebar geometry, persisted state, layout primitives)
//   ucsFreshUser      a brand-new signed-in user with no documents, already signed in on this browser context
//                     (its mcv_session cookie replaces the seeded e2e one); deleted after the test. Tag @creates-data.
export const test = shared.extend<{ shellLayoutPage: ShellLayoutPage; ucsFreshUser: SeededUser }>({
  shellLayoutPage: async ({ page }, use) => use(new ShellLayoutPage(page)),
  ucsFreshUser: async ({ context, urls }, use) => {
    const user = await createSignedInUser();
    const token = user.cookie.slice(`${SESSION_COOKIE}=`.length);
    // Cookies are host-scoped, not port-scoped: one cookie on the web host also reaches the API on another port.
    await context.addCookies([{ name: SESSION_COOKIE, value: token, url: urls.webUrl, httpOnly: true, sameSite: "Lax" }]);
    await use(user);
    await deleteUsers([user.userId]);
  },
});
