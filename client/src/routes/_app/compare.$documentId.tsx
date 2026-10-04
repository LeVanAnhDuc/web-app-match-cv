import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "#/components/RequireAuth";
import CvComparison from "#/views/CvComparison";

export const Route = createFileRoute("/_app/compare/$documentId")({
  // The selected JD lives in the URL so a reload — or a shared link — keeps
  // showing the same comparison.
  validateSearch: (search: Record<string, unknown>): { jd?: string } => ({
    jd: typeof search.jd === "string" && search.jd ? search.jd : undefined
  }),
  component: RouteComponent
});

function RouteComponent() {
  const { documentId } = Route.useParams();
  const { jd } = Route.useSearch();
  return (
    <RequireAuth titleKey="gate.compare">
      <CvComparison documentId={documentId} jdDocumentId={jd} />
    </RequireAuth>
  );
}
