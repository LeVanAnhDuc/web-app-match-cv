import { beforeEach, describe, expect, it } from "vitest";
import { useUiStore } from "../ui";

const KEY = "ui.sidebarCollapsed";

describe("ui store — sidebar collapse", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useUiStore.setState({ isSidebarCollapsed: false });
  });

  it("defaults to expanded", () => {
    expect(useUiStore.getState().isSidebarCollapsed).toBe(false);
  });

  it("toggle flips the state and persists it", () => {
    useUiStore.getState().toggleSidebar();

    expect(useUiStore.getState().isSidebarCollapsed).toBe(true);
    expect(window.localStorage.getItem(KEY)).toBe("true");

    useUiStore.getState().toggleSidebar();

    expect(useUiStore.getState().isSidebarCollapsed).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe("false");
  });

  // [EP] persisted-value classes: "true" / "false" / "" / garbage / missing
  it.each([
    ["true", true],
    ["false", false],
    ["", false],
    ["maybe", false]
  ])("hydrate with %j yields collapsed=%s", (stored, expected) => {
    window.localStorage.setItem(KEY, stored);

    useUiStore.getState().hydrateSidebar();

    expect(useUiStore.getState().isSidebarCollapsed).toBe(expected);
  });

  it("hydrate with no stored key leaves the default", () => {
    useUiStore.getState().hydrateSidebar();

    expect(useUiStore.getState().isSidebarCollapsed).toBe(false);
  });
});
