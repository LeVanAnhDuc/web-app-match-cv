import { Button, Popover, Tooltip } from "antd";
import { LogOut } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import UserAvatar from "#/components/UserAvatar";
import { useAuth, useSignOut } from "#/hooks/useAuth";

const AccountMenu = ({
  placement = "bottomRight",
  tooltip = false
}: {
  placement?: "bottomRight" | "rightBottom";
  tooltip?: boolean;
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const signOut = useSignOut();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const signOutRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  // Move focus into the popover when it opens and back to the trigger when it
  // closes, so keyboard users never lose their place.
  useEffect(() => {
    if (open) {
      const id = window.setTimeout(() => signOutRef.current?.focus(), 0);
      wasOpen.current = true;
      return () => window.clearTimeout(id);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  if (!user) return null;

  const name = user.fullName ?? user.email ?? "";

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") setOpen(false);
  };

  const content = (
    <div
      role="dialog"
      aria-label={t("auth.account")}
      onKeyDown={onKeyDown}
      className="flex w-56 flex-col gap-2"
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-body">{name}</p>
        {user.fullName && (
          <p className="truncate text-xs text-muted">{user.email}</p>
        )}
      </div>
      <Button
        ref={signOutRef}
        type="text"
        icon={<LogOut size={18} />}
        loading={signOut.isPending}
        onClick={() => signOut.mutate()}
        className="!h-11 w-full !justify-start !text-muted hover:!text-body"
      >
        {t("auth.signOut")}
      </Button>
    </div>
  );

  const trigger = (
    <Button
      ref={triggerRef}
      type="text"
      aria-label={t("auth.account")}
      aria-haspopup="dialog"
      aria-expanded={open}
      className="!size-11 !p-0"
    >
      <UserAvatar fullName={user.fullName} email={user.email} />
    </Button>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      placement={placement}
      open={open}
      onOpenChange={setOpen}
    >
      {tooltip ? (
        <Tooltip title={name} placement="right" trigger="hover">
          {trigger}
        </Tooltip>
      ) : (
        trigger
      )}
    </Popover>
  );
};

export default AccountMenu;
