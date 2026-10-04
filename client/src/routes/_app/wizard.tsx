import { createFileRoute } from "@tanstack/react-router";
import Wizard from "#/views/Wizard";

export const Route = createFileRoute("/_app/wizard")({
  // `runId` is the returnTo of "Sign in to keep it": signing in is a full-page
  // redirect, so the wizard store is gone and the URL is all that survives.
  // `claimed=1` is appended by the OAuth callback once the guest's data moved.
  validateSearch: (
    search: Record<string, unknown>
  ): { runId?: string; claimed?: "1" } => ({
    runId:
      typeof search.runId === "string" && search.runId
        ? search.runId
        : undefined,
    claimed:
      search.claimed === "1" || search.claimed === 1
        ? ("1" as const)
        : undefined
  }),
  component: Wizard
});
