import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";

/** TanStack Devtools plugin config for the React Query panel (see `routes/__root.tsx`). */
export default {
  name: "Tanstack Query",
  render: <ReactQueryDevtoolsPanel />
};
