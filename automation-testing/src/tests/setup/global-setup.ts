import { test as setup } from "@playwright/test";
import { resetGuestUsage, seedSignedInSession } from "@/utils/auth-state";
import { cleanDocuments } from "@/utils/db-cleanup";

// Runs once before the app* projects (project dependency, not config globalSetup, so `pnpm test:unit` never touches
// the database). Clean slate first, in case a previous run crashed before teardown.
setup("seed signed-in session", async () => {
  await cleanDocuments();
  await resetGuestUsage();
  await seedSignedInSession();
});
