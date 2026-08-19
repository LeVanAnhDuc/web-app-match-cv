import { cleanDocuments } from "./db-cleanup";

/** Remove every Document row the suite created, so re-runs stay idempotent. */
export default async function globalTeardown(): Promise<void> {
  await cleanDocuments();
}
