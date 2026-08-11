import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "#/i18n/config";
import Sidebar from "../index";

function renderSidebar(collapsed = false, initialPath = "/") {
  const rootRoute = createRootRoute({
    component: () => <Sidebar collapsed={collapsed} />
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialPath] })
  });
  return render(<RouterProvider router={router} />);
}

describe("Sidebar", () => {
  it("renders the 4 nav links with accessible names (en)", async () => {
    renderSidebar();

    expect(
      await screen.findByRole("link", { name: /dashboard/i })
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: /cv .* jd matching/i })
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: /curriculum vitae/i })
    ).toBeDefined();
    expect(
      screen.getByRole("link", { name: /job descriptions/i })
    ).toBeDefined();
  });

  it("marks only the current route as active", async () => {
    renderSidebar(false, "/");

    const active = await screen.findByRole("link", { name: /dashboard/i });
    expect(active.getAttribute("aria-current")).toBe("page");

    for (const name of [
      /cv .* jd matching/i,
      /curriculum vitae/i,
      /job descriptions/i
    ]) {
      expect(
        screen.getByRole("link", { name }).getAttribute("aria-current")
      ).toBeNull();
    }
  });

  it("gives every idle item the same class string", async () => {
    renderSidebar(false, "/");
    await screen.findByRole("link", { name: /dashboard/i });

    const idle = [
      /cv .* jd matching/i,
      /curriculum vitae/i,
      /job descriptions/i
    ].map((name) => screen.getByRole("link", { name }).className);

    expect(new Set(idle).size).toBe(1);
  });

  it("keeps accessible names but hides label text when collapsed", async () => {
    renderSidebar(true, "/");

    const link = await screen.findByRole("link", { name: /curriculum vitae/i });
    expect(link).toBeDefined();
    expect(screen.queryByText("Curriculum Vitae")).toBeNull();
  });
});
