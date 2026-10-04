import { Button, Popover } from "antd";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import UserAvatar from "#/components/UserAvatar";
import { useAuth, useSignOut } from "#/hooks/useAuth";

const AccountMenu = ({
  placement = "bottomRight"
}: {
  placement?: "bottomRight" | "rightBottom";
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const signOut = useSignOut();

  if (!user) return null;

  const content = (
    <div className="flex w-56 flex-col gap-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-body">
          {user.fullName ?? user.email}
        </p>
        {user.fullName && (
          <p className="truncate text-xs text-muted">{user.email}</p>
        )}
      </div>
      <Button
        type="text"
        icon={<LogOut size={18} />}
        loading={signOut.isPending}
        onClick={() => signOut.mutate()}
        className="!h-11 w-full !justify-start"
      >
        {t("auth.signOut")}
      </Button>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement={placement}>
      <Button
        type="text"
        aria-label={t("auth.account")}
        aria-haspopup="dialog"
        className="!size-11 !p-0"
      >
        <UserAvatar fullName={user.fullName} email={user.email} />
      </Button>
    </Popover>
  );
};

export default AccountMenu;
