import { useRouterState } from "@tanstack/react-router";

/** Current path + query, the value `signInUrl()` expects as `returnTo`. */
export function useReturnTo(): string {
  return useRouterState({
    select: (s) => s.location.pathname + s.location.searchStr
  });
}
