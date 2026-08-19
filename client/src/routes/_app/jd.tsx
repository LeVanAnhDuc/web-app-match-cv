import { createFileRoute } from "@tanstack/react-router";
import JdLibrary from "#/views/JdLibrary";

export const Route = createFileRoute("/_app/jd")({
  component: JdLibrary
});
