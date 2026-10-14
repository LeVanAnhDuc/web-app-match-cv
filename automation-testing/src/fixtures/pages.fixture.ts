import { AppShell } from "@/components/app-shell.component";
import { test as core } from "./core.fixture";

// Shared UI objects. A page object that belongs to ONE module goes in that module's slot
// (fixtures/modules/<module>.fixture.ts), named like the class in camelCase (WizardPage → wizardPage):
//   import { WizardPage } from "@/pages/wizard/wizard.page";
//   export const test = shared.extend<{ wizardPage: WizardPage }>({
//     wizardPage: async ({ page }, use) => use(new WizardPage(page)),
//   });
//   shell   AppShell (sidebar, header, mobile drawer, account menu, guest card) on the test's page
export const test = core.extend<{ shell: AppShell }>({
  shell: async ({ page }, use) => use(new AppShell(page)),
});
