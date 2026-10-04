import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import { signInUrl } from "#/libs/api";
import SignInGate from "../index";

function renderGate(
  props: Parameters<typeof SignInGate>[0],
  path = "/cv?page=2"
) {
  const rootRoute = createRootRoute({
    component: () => <SignInGate {...props} />
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] })
  });
  return render(<RouterProvider router={router} />);
}

afterEach(() => vi.useRealTimers());

describe("SignInGate", () => {
  it("route variant: title, description, sign-in link to the current path, back link", async () => {
    renderGate({
      variant: "route",
      title: "Sign in to see your saved CVs",
      description: "Saved CVs belong to your account.",
      backTo: "/wizard"
    });

    expect(
      await screen.findByRole("heading", {
        name: "Sign in to see your saved CVs"
      })
    ).toBeDefined();
    expect(screen.getByText("Saved CVs belong to your account.")).toBeDefined();
    const signIn = screen.getByRole("link", { name: "Sign in with Ducker ID" });
    expect(signIn.getAttribute("href")).toBe(signInUrl("/cv?page=2"));
    const back = screen.getByRole("link", { name: "Back to matching" });
    expect(back.getAttribute("href")).toBe("/wizard");
    expect(screen.queryByText(/Resets in/)).toBeNull();
  });

  it("quota variant: countdown in mono tabular figures and back-to-home", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-04T00:00:00Z"));
    renderGate({
      variant: "quota",
      title: "You have used today's 5 free matches",
      description: "Guest matches run on the system AI key.",
      resetsAt: "2026-10-04T06:12:00Z",
      backTo: "/"
    });

    const time = await screen.findByText("6 h 12 min");
    expect(time.className).toContain("font-mono");
    expect(time.className).toContain("tabular-nums");
    expect(time.parentElement?.textContent).toBe("Resets in 6 h 12 min");
    expect(
      screen.getByRole("link", { name: "Back to home" }).getAttribute("href")
    ).toBe("/");
  });
});
