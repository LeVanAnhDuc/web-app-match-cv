import { cleanDocuments } from "./db-cleanup";

/** Clean slate before the run, in case a previous run crashed before teardown. */
export default async function globalSetup(): Promise<void> {
  await cleanDocuments();
}
