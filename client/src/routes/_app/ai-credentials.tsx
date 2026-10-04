import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "#/components/RequireAuth";
import AiCredentials from "#/views/AiCredentials";

export const Route = createFileRoute("/_app/ai-credentials")({
  component: () => (
    <RequireAuth titleKey="gate.aiCredentials">
      <AiCredentials />
    </RequireAuth>
  )
});
