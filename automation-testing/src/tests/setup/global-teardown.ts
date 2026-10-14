import { test as teardown } from "@playwright/test";
import { removeSignedInSession, resetGuestUsage } from "@/utils/auth-state";
import { cleanDocuments } from "@/utils/db-cleanup";

// Remove every Document row the suite created, so re-runs stay idempotent.
teardown("clean suite data", async () => {
  await cleanDocuments();
  await resetGuestUsage();
  await removeSignedInSession();
});
