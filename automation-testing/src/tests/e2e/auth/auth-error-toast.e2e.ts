import { test, expect } from "@/fixtures";
import { AUTH_ERROR_CODES, UNKNOWN_AUTH_ERROR, authErrorKey } from "@/data/test-data/auth";
import type { CopyKey } from "@/data/copy";

// Where a failed sign-in lands: /?authError=<code> (REQ-AUTH-26). The callback only ever redirects there, so the
// specs open that URL directly; which code each failure produces is proven at the API layer (callback.api.ts).

test.use({ storageState: { cookies: [], origins: [] } });

const ALL_TOAST_KEYS: CopyKey[] = [...AUTH_ERROR_CODES.map(authErrorKey), "auth.error.generic"];

test.describe("Sign-in error toast", () => {
  test(
    "authError hiện đúng một toast cho từng mã, mã lạ hiện thông báo chung",
    { tag: ["@TC-AUTH-047"] },
    async ({ authErrorPage }) => {
      for (const [code, key] of [
        ...AUTH_ERROR_CODES.map((c) => [c, authErrorKey(c)] as const),
        [UNKNOWN_AUTH_ERROR, "auth.error.generic"] as const,
      ]) {
        await authErrorPage.goto(code);
        await expect(authErrorPage.toast(key), code).toBeVisible();
        await expect(authErrorPage.anyAuthErrorToast(ALL_TOAST_KEYS), code).toHaveCount(1);
      }
    }
  );

  test(
    "authError bị xoá khỏi URL và tải lại không hiện lại toast",
    { tag: ["@TC-AUTH-048"] },
    async ({ authErrorPage, page }) => {
      await authErrorPage.goto("denied");
      await expect(authErrorPage.toast("auth.error.denied")).toBeVisible();
      await authErrorPage.waitForParamCleared();
      expect(new URL(page.url()).searchParams.has("authError")).toBe(false);

      await authErrorPage.reload();
      await expect(authErrorPage.anyAuthErrorToast(ALL_TOAST_KEYS)).toHaveCount(0);
    }
  );
});
