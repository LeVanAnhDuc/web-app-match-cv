import { createFileRoute } from "@tanstack/react-router";
import AiCredentials from "#/views/AiCredentials";

export const Route = createFileRoute("/_app/ai-credentials")({
  component: AiCredentials
});
