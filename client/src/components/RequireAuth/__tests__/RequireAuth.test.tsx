import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import { useAuth } from "#/hooks/useAuth";
import RequireAuth from "../index";

vi.mock("#/hooks/useAuth");

const auth = (status: "anonymous" | "guest" | "user" | "loading") => ({
  status,
  user: null,
  guestQuota: null,
  isUser: status === "user"
});

function renderGuarded() {
  const rootRoute = createRootRoute({
    component: () => (
      <RequireAuth titleKey="gate.cv">
        <p>secret page</p>
      </RequireAuth>
    )
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/cv"] })
  });
  return render(<RouterProvider router={router} />);
}

describe("RequireAuth", () => {
  beforeEach(() => vi.mocked(useAuth).mockReset());

  it("renders children for a signed-in user", async () => {
    vi.mocked(useAuth).mockReturnValue(auth("user"));
    renderGuarded();
    expect(await screen.findByText("secret page")).toBeDefined();
  });

  it.each(["guest", "anonymous"] as const)(
    "shows the sign-in gate, not the page, for %s",
    async (status) => {
      vi.mocked(useAuth).mockReturnValue(auth(status));
      renderGuarded();
      expect(
        await screen.findByRole("heading", {
          name: "Sign in to see your saved CVs"
        })
      ).toBeDefined();
      expect(screen.queryByText("secret page")).toBeNull();
    }
  );

  it("shows a skeleton while loading, neither page nor gate", async () => {
    vi.mocked(useAuth).mockReturnValue(auth("loading"));
    const { container } = renderGuarded();
    await waitFor(() =>
      expect(container.querySelector("[aria-busy='true']")).not.toBeNull()
    );
    expect(screen.queryByText("secret page")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
