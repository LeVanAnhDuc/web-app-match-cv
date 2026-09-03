import { Button, Drawer } from "antd";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  WandSparkles
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { PropsWithChildren, ReactNode } from "react";
import { useUiStore } from "#/stores";
import Sidebar from "./components/Sidebar";

const AppShell = ({
  children,
  actionBar
}: PropsWithChildren<{ actionBar?: ReactNode }>) => {
  const { t } = useTranslation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const isCollapsed = useUiStore((s) => s.isSidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const hydrateSidebar = useUiStore((s) => s.hydrateSidebar);

  // Read the persisted choice only after mount: reading it during render would
  // make the server HTML (always expanded) disagree with the first client pass.
  useEffect(() => {
    hydrateSidebar();
  }, [hydrateSidebar]);

  return (
    <div className="flex min-h-dvh bg-app lg:h-dvh lg:overflow-hidden">
      <aside
        id="app-sidebar"
        className={`hidden shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${
          isCollapsed ? "w-16" : "w-72"
        }`}
      >
        <div
          className={`flex items-center gap-3 px-4 py-4 ${
            isCollapsed ? "flex-col" : ""
          }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <WandSparkles className="text-white" size={18} />
          </div>
          {!isCollapsed && (
            <span className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-body">
              {t("appName")}
            </span>
          )}
          <Button
            type="text"
            aria-label={t(isCollapsed ? "nav.expand" : "nav.collapse")}
            aria-expanded={!isCollapsed}
            aria-controls="app-sidebar"
            icon={
              isCollapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )
            }
            onClick={toggleSidebar}
            className="text-muted"
          />
        </div>
        <Sidebar collapsed={isCollapsed} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 lg:hidden">
          <Button
            type="text"
            aria-label={t("nav.openMenu")}
            icon={<Menu size={20} />}
            onClick={() => setIsDrawerOpen(true)}
            className="text-muted"
          />
          <span className="truncate text-base font-bold tracking-tight text-body">
            {t("appName")}
          </span>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        {actionBar && (
          <div className="sticky bottom-0 z-20 shrink-0 border-t border-line bg-surface px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
            {actionBar}
          </div>
        )}
      </div>
      <Drawer
        placement="left"
        closable
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={t("appName")}
        width={256}
        styles={{ body: { padding: 0 } }}
      >
        <Sidebar />
      </Drawer>
    </div>
  );
};

export default AppShell;
