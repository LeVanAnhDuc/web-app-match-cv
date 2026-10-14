import { test as core } from "./core.fixture";

// One fixture per page object, named like the class in camelCase (SignInPage → signInPage):
//   import { SignInPage } from "@/pages/auth/sign-in.page";
//   export const test = core.extend<{ signInPage: SignInPage }>({
//     signInPage: async ({ page }, use) => use(new SignInPage(page)),
//   });
export const test = core.extend<{}>({});
