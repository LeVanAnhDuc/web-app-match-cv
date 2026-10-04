import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "#/components/RequireAuth";
import CvLibrary from "#/views/CvLibrary";

export const Route = createFileRoute("/_app/cv")({
  component: () => (
    <RequireAuth titleKey="gate.cv">
      <CvLibrary />
    </RequireAuth>
  )
});
