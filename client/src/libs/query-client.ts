import { QueryClient } from "@tanstack/react-query";

/**
 * Builds the router context object. TanStack Start's SSR query integration
 * (see `router.tsx` → `setupRouterSsrQueryIntegration`) provides the
 * QueryClient to the tree via router context — there is no explicit
 * `<QueryClientProvider>` component in the app shell.
 */
export function getContext() {
  const queryClient = new QueryClient();

  return { queryClient };
}
