import { Outlet, createFileRoute, useMatchRoute } from "@tanstack/react-router";
import AuthErrorToast from "#/components/AuthErrorToast";
import AppShell from "#/layouts/AppShell";
import { useWizardStore } from "#/stores";
import ResultActionBar from "#/views/Wizard/components/ResultActionBar";

// Step 4 of the wizard is a COLUMN of provider cards, not a single
// SectionCard — there is no footer to pin "Start over" to,
// so the shell renders that bar itself instead of the view. Decided here
// (route + step + resultReady), not stashed as a ReactNode in the store
// (stores.md) — resultReady is a plain boolean StepResult writes once it
// knows its query landed on an actual report rather than a loading/error/
// guard screen, so the shell bar never doubles up with StepResult's own
// inline "Start over" on those screens.
const AppRoute = () => {
  const matchRoute = useMatchRoute();
  const step = useWizardStore((s) => s.step);
  const resultReady = useWizardStore((s) => s.resultReady);
  const showResultActionBar =
    Boolean(matchRoute({ to: "/wizard" })) && step === 4 && resultReady;

  return (
    <AppShell actionBar={showResultActionBar ? <ResultActionBar /> : undefined}>
      <AuthErrorToast />
      <Outlet />
    </AppShell>
  );
};

export const Route = createFileRoute("/_app")({
  // The OAuth callback redirects to `/?authError=<code>`.
  validateSearch: (
    search: Record<string, unknown>
  ): { authError?: string } => ({
    authError:
      typeof search.authError === "string" && search.authError
        ? search.authError
        : undefined
  }),
  component: AppRoute
});
