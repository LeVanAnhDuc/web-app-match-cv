import { Button } from "antd";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import UserAvatar from "#/components/UserAvatar";
import { useAuth, useSignOut } from "#/hooks/useAuth";
import AccountMenu from "../AccountMenu";

const UserCard = ({ collapsed = false }: { collapsed?: boolean }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const signOut = useSignOut();

  if (!user) return null;

  if (collapsed) {
    return (
      <div className="mt-auto flex justify-center px-2 py-3">
        <AccountMenu placement="rightBottom" />
      </div>
    );
  }

  return (
    <div className="mt-auto p-4">
      <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
        <div className="flex items-center gap-3">
          <UserAvatar fullName={user.fullName} email={user.email} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-body">
              {user.fullName ?? user.email}
            </p>
            {user.fullName && (
              <p className="truncate text-xs text-muted">{user.email}</p>
            )}
          </div>
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
    </div>
  );
};

export default UserCard;
