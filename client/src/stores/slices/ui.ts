import { create } from "zustand";

const SIDEBAR_STORAGE_KEY = "ui.sidebarCollapsed";

interface UiState {
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  hydrateSidebar: () => void;
}

/**
 * Shell UI state. The sidebar starts expanded so SSR and the first client
 * render agree; AppShell calls `hydrateSidebar` in an effect to apply the
 * persisted choice once the DOM is live.
 */
export const useUiStore = create<UiState>((set, get) => ({
  isSidebarCollapsed: false,

  toggleSidebar: () => {
    const next = !get().isSidebarCollapsed;
    set({ isSidebarCollapsed: next });
    try {
      window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
    } catch {
      // Storage disabled (private mode / quota) — keep the in-memory state.
    }
  },

  hydrateSidebar: () => {
    try {
      const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
      // Anything other than the two known values is treated as absent.
      if (stored === "true" || stored === "false") {
        set({ isSidebarCollapsed: stored === "true" });
      }
    } catch {
      // Storage unreadable — stay expanded.
    }
  }
}));
