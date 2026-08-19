import { createFileRoute } from "@tanstack/react-router";
import Wizard from "#/views/Wizard";

export const Route = createFileRoute("/_app/wizard")({ component: Wizard });
