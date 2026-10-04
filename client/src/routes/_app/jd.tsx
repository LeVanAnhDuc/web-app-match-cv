import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "#/components/RequireAuth";
import JdLibrary from "#/views/JdLibrary";

export const Route = createFileRoute("/_app/jd")({
  component: () => (
    <RequireAuth titleKey="gate.jd">
      <JdLibrary />
    </RequireAuth>
  )
});
