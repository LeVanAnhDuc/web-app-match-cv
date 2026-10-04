import { AsyncLocalStorage } from "async_hooks";

/**
 * Who the current HTTP request acts as. Filled by SessionMiddleware for every
 * request, mutated once by AuthGuard when it lazily creates a guest. Read only
 * through CurrentUserService so no service learns where the id comes from
 * (ADR-0022 — "when auth arrives only the source of userId changes").
 */
export interface RequestContextStore {
  userId: string | null;
  isGuest: boolean;
  sessionToken: string | null;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();
