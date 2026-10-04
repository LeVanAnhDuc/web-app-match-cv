import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter
} from "@tanstack/react-router";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "#/i18n/config";
import { useAuth, useSignOut } from "#/hooks/useAuth";
import { signInUrl } from "#/libs/api";
import { useUiStore } from "#/stores";
import AppShell from "../index";

vi.mock("#/hooks/useAuth");

const mutate = vi.fn();

type AuthState = ReturnType<typeof useAuth>;

function mockAuth(state: Partial<AuthState>) {
  vi.mocked(useAuth).mockReturnValue({
    status: "user",
    user: null,
    guestQuota: null,
    isUser: false,
    ...state
  });
}

const GUEST: Partial<AuthState> = {
  status: "guest",
  guestQuota: { limit: 5, used: 2, resetsAt: "2026-10-05T00:00:00.000Z" }
};
const USER: Partial<AuthState> = {
  status: "user",
  isUser: true,
  user: {
    id: "u1",
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    avatar: null
  }
};

function renderShell(path = "/") {
  const rootRoute = createRootRoute({
    component: () => <AppShell>page body</AppShell>
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [path] })
  });
  return render(<RouterProvider router={router} />);
}

describe("AppShell", () => {
  beforeEach(() => {
    mutate.mockReset();
    vi.mocked(useSignOut).mockReturnValue({
      mutate,
      isPending: false
    } as unknown as ReturnType<typeof useSignOut>);
    mockAuth(USER);
    window.localStorage.clear();
    useUiStore.setState({ isSidebarCollapsed: false });
  });

  it("renders the collapse control expanded by default", async () => {
    renderShell();

    const toggle = await screen.findByRole("button", {
      name: /collapse sidebar/i
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.getAttribute("aria-controls")).toBe("app-sidebar");
  });

  it("toggling collapses the sidebar and flips the control label", async () => {
    renderShell();

    fireEvent.click(
      await screen.findByRole("button", { name: /collapse sidebar/i })
    );

    const toggle = await screen.findByRole("button", {
      name: /expand sidebar/i
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(useUiStore.getState().isSidebarCollapsed).toBe(true);
    expect(window.localStorage.getItem("ui.sidebarCollapsed")).toBe("true");
  });

  it("applies the persisted collapsed state after mount", async () => {
    window.localStorage.setItem("ui.sidebarCollapsed", "true");

    renderShell();

    expect(
      await screen.findByRole("button", { name: /expand sidebar/i })
    ).toBeDefined();
  });

  it("không dùng h-screen; khoá viewport chỉ ở desktop", async () => {
    renderShell();

    const aside = await screen.findByRole("complementary", { hidden: true });
    const shell = aside.parentElement;
    const classStr = shell?.getAttribute("class") || "";
    expect(classStr).not.toContain("h-screen");
    expect(classStr).toContain("min-h-dvh");
    expect(classStr).toContain("lg:h-dvh");
    expect(classStr).toContain("lg:overflow-hidden");
  });

  it("render actionBar ghim đáy khi được truyền", async () => {
    const rootRoute = createRootRoute({
      component: () => (
        <AppShell actionBar={<button>Lưu báo cáo</button>}>page body</AppShell>
      )
    });
    const router = createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ["/"] })
    });
    render(<RouterProvider router={router} />);

    const bar = (await screen.findByRole("button", { name: "Lưu báo cáo" }))
      .parentElement;
    expect(bar?.className).toContain("sticky");
    expect(bar?.className).toContain("bottom-0");
    expect(bar?.className).not.toContain("lg:static");
  });

  describe("guest", () => {
    beforeEach(() => mockAuth(GUEST));

    it("shows only Home and Match in the nav", async () => {
      renderShell();

      await screen.findByRole("link", { name: /dashboard/i });
      const nav = screen.getByRole("navigation");
      expect(within(nav).getAllByRole("link")).toHaveLength(2);
      expect(
        within(nav).getByRole("link", { name: /matching/i })
      ).toBeDefined();
    });

    it("shows the guest card with a sign-in link back to the current page", async () => {
      renderShell("/wizard?runId=abc");

      expect(await screen.findByText("Guest mode")).toBeDefined();
      const link = screen.getByRole("link", { name: "Sign in with Ducker ID" });
      expect(link.getAttribute("href")).toBe(signInUrl("/wizard?runId=abc"));
    });

    it("shows the remaining free matches", async () => {
      renderShell();

      expect(await screen.findByText("Free matches today")).toBeDefined();
      expect(screen.getByText("3 / 5 left")).toBeDefined();
    });

    it("shows a Sign in link in the header", async () => {
      renderShell("/");

      const link = await screen.findByRole("link", { name: "Sign in" });
      expect(link.getAttribute("href")).toBe(signInUrl("/"));
    });

    it("does not render a user card", async () => {
      renderShell();

      await screen.findByText("Guest mode");
      expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    });
  });

  describe("user", () => {
    it("shows all six nav items", async () => {
      renderShell();

      await screen.findByRole("link", { name: /dashboard/i });
      const nav = screen.getByRole("navigation");
      expect(within(nav).getAllByRole("link")).toHaveLength(6);
    });

    it("shows the user card and signs out", async () => {
      renderShell();

      expect(await screen.findByText("Ada Lovelace")).toBeDefined();
      expect(screen.getByText("ada@example.com")).toBeDefined();
      expect(screen.queryByText("Guest mode")).toBeNull();

      fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
      expect(mutate).toHaveBeenCalledTimes(1);
    });

    it("shows an Account button in the header instead of Sign in", async () => {
      renderShell();

      expect(
        await screen.findByRole("button", { name: "Account" })
      ).toBeDefined();
      expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
    });
  });

  it("renders neither card while auth is loading", async () => {
    mockAuth({ status: "loading" });
    renderShell();

    await screen.findByRole("link", { name: /dashboard/i });
    expect(screen.queryByText("Guest mode")).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Account" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Sign in" })).toBeNull();
  });

  it("pins the account card inside the open drawer", async () => {
    mockAuth(USER);
    renderShell();

    fireEvent.click(await screen.findByRole("button", { name: /open menu/i }));

    const drawer = await screen.findByRole("dialog");
    expect(within(drawer).getByText("Ada Lovelace")).toBeDefined();
    expect(
      within(drawer).getByRole("button", { name: "Sign out" })
    ).toBeDefined();
    const body = drawer.querySelector(".ant-drawer-body") as HTMLElement;
    expect(body.style.display).toBe("flex");
    expect(body.style.flexDirection).toBe("column");
  });

  it("account menu is keyboard-operable", async () => {
    mockAuth(USER);
    renderShell();

    const trigger = await screen.findByRole("button", { name: "Account" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(trigger);

    const menu = await screen.findByRole("dialog", { name: "Account" });
    const signOut = within(menu).getByRole("button", { name: "Sign out" });
    await waitFor(() => expect(document.activeElement).toBe(signOut));
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(signOut, { key: "Escape" });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });
});
