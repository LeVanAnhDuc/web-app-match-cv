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

function createWrapper(
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  })
) {
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

  it("stays anonymous when the guest view mounts another observer after a failure", async () => {
    vi.mocked(fetchMe).mockRejectedValue(new Error("network"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const first = renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient)
    });
    await waitFor(() => expect(first.result.current.status).toBe("anonymous"));

    const second = renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient)
    });

    expect(second.result.current.status).toBe("anonymous");
    expect(first.result.current.status).toBe("anonymous");
    expect(fetchMe).toHaveBeenCalledTimes(1);
  });

  it("keeps the guest view while a refetch after a failure is in flight", async () => {
    vi.mocked(fetchMe).mockRejectedValueOnce(new Error("network"));
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient)
    });
    await waitFor(() => expect(result.current.status).toBe("anonymous"));

    vi.mocked(fetchMe).mockReturnValue(new Promise(() => {}));
    void queryClient.refetchQueries({ queryKey: ["auth", "me"] });

    await waitFor(() => expect(fetchMe).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe("anonymous");
  });
});
