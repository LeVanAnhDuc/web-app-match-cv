import { expect, mergeTests } from "@playwright/test";
import { test as aiCredentialsTest } from "./modules/ai-credentials.fixture";
import { test as authTest } from "./modules/auth.fixture";
import { test as coverLetterGeneratorTest } from "./modules/cover-letter-generator.fixture";
import { test as cvJdMatchingWizardTest } from "./modules/cv-jd-matching-wizard.fixture";
import { test as cvRewriteAssistantTest } from "./modules/cv-rewrite-assistant.fixture";
import { test as cvVersionComparisonTest } from "./modules/cv-version-comparison.fixture";
import { test as dataExportTest } from "./modules/data-export.fixture";
import { test as documentsTest } from "./modules/documents.fixture";
import { test as guestModeTest } from "./modules/guest-mode.fixture";
import { test as homeDashboardLibraryTest } from "./modules/home-dashboard-library.fixture";
import { test as infraTest } from "./modules/infra.fixture";
import { test as multiProviderCompareTest } from "./modules/multi-provider-compare.fixture";
import { test as uiConsistencyShellTest } from "./modules/ui-consistency-shell.fixture";
import { test as sharedTest } from "./shared.fixture";

// The only `test` / `expect` specs import. Shared concerns (each extends core):
//   core      env (worker), urls, guard (auto: blocks @creates-data on prd)
//   accounts  account
//   pages     shell (AppShell)
//   http      http(cookie?) — raw HTTP factory (worker), used by migrated specs
//   api       api (seeded e2e user), anonApi, apiAs(identity) — typed clients of src/api (worker)
//   network   network — page.route stubs (AI responses) + request recording
// shared.fixture.ts merges those; every module slot extends it, and all slots are merged here, so a module agent
// only ever edits fixtures/modules/<module>.fixture.ts.
export const test = mergeTests(
  sharedTest,
  cvJdMatchingWizardTest,
  documentsTest,
  homeDashboardLibraryTest,
  uiConsistencyShellTest,
  aiCredentialsTest,
  multiProviderCompareTest,
  cvRewriteAssistantTest,
  coverLetterGeneratorTest,
  cvVersionComparisonTest,
  dataExportTest,
  authTest,
  guestModeTest,
  infraTest
);
export { expect };
