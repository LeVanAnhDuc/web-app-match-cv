import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter
} from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import "#/i18n/config";
import { useUiStore } from "#/stores";
import AppShell from "../index";

function renderShell() {
  const rootRoute = createRootRoute({
    component: () => <AppShell>page body</AppShell>
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] })
  });
  return render(<RouterProvider router={router} />);
}

describe("AppShell", () => {
  beforeEach(() => {
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
});
