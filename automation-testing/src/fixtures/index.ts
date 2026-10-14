import { expect, mergeTests } from "@playwright/test";
import { test as accountsTest } from "./accounts.fixture";
import { test as httpTest } from "./http.fixture";
import { test as pagesTest } from "./pages.fixture";

// The only `test` / `expect` specs import. Each fixture file owns one concern and extends core:
//   core      env (worker), urls, guard (auto: blocks @creates-data on prd)
//   accounts  account
//   pages     page objects
//   http      http(cookie?) — API client for tests/api/** (worker)
// A new concern (api client, mail inbox, rate gate…) gets its own *.fixture.ts and joins mergeTests here.
export const test = mergeTests(accountsTest, pagesTest, httpTest);
export { expect };
