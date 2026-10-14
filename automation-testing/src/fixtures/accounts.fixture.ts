import { getFixedAccount, type Account } from "@/config/accounts";
import { test as core } from "./core.fixture";

export const test = core.extend<{
  // Fixed ACTIVE account (<ENV>_USER_*). Throws when .env lacks it: almost every test needs it.
  account: Account;
}>({
  account: async ({ env }, use) => use(getFixedAccount(env)),
});
