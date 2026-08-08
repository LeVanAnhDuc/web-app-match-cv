import { createFileRoute } from "@tanstack/react-router";
import MyData from "#/views/MyData";

export const Route = createFileRoute("/_app/my-data")({
  component: MyData
});
