import { createFileRoute } from "@tanstack/react-router";
import CvRewrite from "#/views/CvRewrite";

export const Route = createFileRoute("/_app/cv-rewrite/$matchResultId")({
  component: RouteComponent
});

function RouteComponent() {
  const { matchResultId } = Route.useParams();
  return <CvRewrite matchResultId={matchResultId} />;
}
