import { createFileRoute } from "@tanstack/react-router";
import CvLibrary from "#/views/CvLibrary";

export const Route = createFileRoute("/_app/cv")({
  component: CvLibrary
});
