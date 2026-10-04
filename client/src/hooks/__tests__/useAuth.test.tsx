import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PropsWithChildren } from "react";
import { useAuth } from "#/hooks/useAuth";
import { fetchMe } from "#/requests/auth";

vi.mock("#/requests/auth", () => ({
  AUTH_QUERY_KEY: ["auth", "me"],
  fetchMe: vi.fn(),
  logout: vi.fn()
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

afterEach(() => vi.clearAllMocks());

describe("useAuth", () => {
  it("is loading while the first fetch is pending", () => {
    vi.mocked(fetchMe).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    });

    expect(result.current.status).toBe("loading");
  });

  it("falls back to anonymous when /auth/me fails", async () => {
    vi.mocked(fetchMe).mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper()
    });

    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    expect(result.current.user).toBeNull();
    expect(result.current.guestQuota).toBeNull();
    expect(result.current.isUser).toBe(false);
  });
});
