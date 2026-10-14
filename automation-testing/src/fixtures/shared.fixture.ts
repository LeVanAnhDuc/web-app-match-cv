import { mergeTests } from "@playwright/test";
import { test as accountsTest } from "./accounts.fixture";
import { test as apiTest } from "./api.fixture";
import { test as httpTest } from "./http.fixture";
import { test as networkTest } from "./network.fixture";
import { test as pagesTest } from "./pages.fixture";

// Every shared fixture in one `test`: the base each module slot (modules/<module>.fixture.ts) extends, so a module
// fixture can depend on `api`, `network`, `shell`, `page`… Specs never import this file: they import "@/fixtures".
export const test = mergeTests(accountsTest, pagesTest, httpTest, apiTest, networkTest);
