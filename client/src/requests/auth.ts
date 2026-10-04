import { apiFetch } from "#/libs/api";
import { ENDPOINTS } from "#/constants";
import type { AuthMeDto } from "#/types/Auth";

export const AUTH_QUERY_KEY = ["auth", "me"] as const;

/** GET /auth/me — who the session cookie says we are. */
export function fetchMe(): Promise<AuthMeDto> {
  return apiFetch<AuthMeDto>(ENDPOINTS.authMe);
}

/** POST /auth/logout — 204; the server clears the cookie. */
export function logout(): Promise<void> {
  return apiFetch<void>(ENDPOINTS.authLogout, { method: "POST" });
}
