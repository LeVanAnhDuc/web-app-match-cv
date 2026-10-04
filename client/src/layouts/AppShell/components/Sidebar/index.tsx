import { Link } from "@tanstack/react-router";
import { Tooltip } from "antd";
import {
  Download,
  FileText,
  FileUser,
  KeyRound,
  LayoutDashboard,
  Sparkles
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "#/hooks/useAuth";
import type { ComponentType } from "react";
import GuestCard from "../GuestCard";
import UserCard from "../UserCard";

interface NavItem {
  to: string;
  icon: ComponentType<{ size?: number }>;
  labelKey: string;
  exact?: boolean;
  guest?: boolean;
}

// Icon mapping per docs/design-system/match-cv/icon-map.md (nav/navigation).
const NAV_ITEMS: Array<NavItem> = [
  {
    to: "/",
    icon: LayoutDashboard,
    labelKey: "nav.home",
    exact: true,
    guest: true
  },
  { to: "/wizard", icon: Sparkles, labelKey: "nav.match", guest: true },
  { to: "/cv", icon: FileUser, labelKey: "nav.savedCvs" },
  { to: "/jd", icon: FileText, labelKey: "nav.savedJds" },
  { to: "/ai-credentials", icon: KeyRound, labelKey: "nav.aiCredentials" },
  { to: "/my-data", icon: Download, labelKey: "nav.myData" }
];

// All four items share one class string — the ONLY visual difference is the
// active state. `text-muted` lives in the idle string rather than the base so
// the active colour cannot lose to it on utility order.
const baseClassName =
  "relative flex items-center gap-3 rounded-md py-2 text-sm font-medium transition-colors";
const idleClassName = "text-muted hover:bg-surface-subtle hover:text-body";
// TanStack appends activeProps.className to className, so this only carries the
// overrides. The active bar is a ::before pseudo-element: no extra DOM node, so
// Playwright locators stay unambiguous.
const activeClassName =
  "bg-primary/10 font-semibold text-accent before:absolute before:top-1/2 before:left-0 before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-r-full before:bg-primary before:content-['']";

const Sidebar = ({ collapsed = false }: { collapsed?: boolean }) => {
  const { t } = useTranslation();
  const { status, isUser } = useAuth();
  const items = isUser ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.guest);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav
        className={`flex flex-col gap-1 py-2 ${collapsed ? "px-2" : "px-4"}`}
      >
        {items.map(({ to, icon: Icon, labelKey, exact }) => {
          const label = t(labelKey);

          const link = (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact }}
              aria-label={collapsed ? label : undefined}
              className={`${baseClassName} ${
                collapsed ? "justify-center px-0" : "px-3"
              } ${idleClassName}`}
              activeProps={{
                className: activeClassName,
                "aria-current": "page"
              }}
            >
              <Icon size={20} />
              {!collapsed && <span className="truncate">{label}</span>}
            </Link>
          );

          return collapsed ? (
            <Tooltip key={to} title={label} placement="right">
              {link}
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>
      {status === "user" && <UserCard collapsed={collapsed} />}
      {(status === "guest" || status === "anonymous") && (
        <GuestCard collapsed={collapsed} />
      )}
    </div>
  );
};

export default Sidebar;
