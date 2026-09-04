import { Outlet, createFileRoute, useMatchRoute } from "@tanstack/react-router";
import AppShell from "#/layouts/AppShell";
import { useWizardStore } from "#/stores";
import ResultActionBar from "#/views/Wizard/components/ResultActionBar";

// Step 4 of the wizard is a COLUMN of provider cards, not a single
// SectionCard — there is no footer to pin "Start over" / "Save report" to,
// so the shell renders that bar itself instead of the view. Decided here
// (route + step), not stashed as a ReactNode in the store (stores.md).
const AppRoute = () => {
  const matchRoute = useMatchRoute();
  const step = useWizardStore((s) => s.step);
  const isWizardResultStep =
    Boolean(matchRoute({ to: "/wizard" })) && step === 4;

  return (
    <AppShell actionBar={isWizardResultStep ? <ResultActionBar /> : undefined}>
      <Outlet />
    </AppShell>
  );
};

export const Route = createFileRoute("/_app")({
  component: AppRoute
});
