import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "#/components/RequireAuth";
import CvRewrite from "#/views/CvRewrite";

export const Route = createFileRoute("/_app/cv-rewrite/$matchResultId")({
  component: RouteComponent
});

function RouteComponent() {
  const { matchResultId } = Route.useParams();
  return (
    <RequireAuth titleKey="gate.cvRewrite">
      <CvRewrite matchResultId={matchResultId} />
    </RequireAuth>
  );
}
