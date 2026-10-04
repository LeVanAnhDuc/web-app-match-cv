import { createFileRoute } from "@tanstack/react-router";
import RequireAuth from "#/components/RequireAuth";
import MyData from "#/views/MyData";

export const Route = createFileRoute("/_app/my-data")({
  component: () => (
    <RequireAuth titleKey="gate.myData">
      <MyData />
    </RequireAuth>
  )
});
