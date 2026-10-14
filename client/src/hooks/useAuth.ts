import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AUTH_QUERY_KEY, fetchMe, logout } from "#/requests/auth";
import type { AuthStatus, AuthUserDto, GuestQuotaDto } from "#/types/Auth";

/**
 * GET /auth/me — anonymous | guest | user, plus the guest quota. A failed
 * request degrades to anonymous so the app shows the guest view, not a skeleton.
 * A refetch of a query without data resets it to pending, so "has failed once"
 * (errorUpdatedAt) keeps it anonymous, and the guest view's own observers must
 * not retry it on mount — that remount loop is what left /cv on a skeleton.
 */
export function useAuth(): {
  status: AuthStatus | "loading";
  user: AuthUserDto | null;
  guestQuota: GuestQuotaDto | null;
  isUser: boolean;
} {
  const { data, errorUpdatedAt } = useQuery({
    queryKey: AUTH_QUERY_KEY,
    queryFn: fetchMe,
    staleTime: 30_000,
    retryOnMount: false
  });

  return {
    status: data?.status ?? (errorUpdatedAt > 0 ? "anonymous" : "loading"),
    user: data?.user ?? null,
    guestQuota: data?.guestQuota ?? null,
    isUser: data?.status === "user"
  };
}

/** POST /auth/logout — drop every cached query, then go home. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      queryClient.clear();
      void navigate({ to: "/" });
    }
  });
}
