import { useNavigate, useSearch } from "@tanstack/react-router";
import { App } from "antd";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

// The OAuth callback redirects to `/?authError=<code>`: show one toast for it,
// then strip the param so a reload does not repeat it.
const AuthErrorToast = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { authError } = useSearch({ from: "/_app" });
  const handled = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!authError) {
      handled.current = undefined;
      return;
    }
    if (handled.current === authError) return;
    handled.current = authError;
    message.error(
      t(`auth.error.${authError}`, { defaultValue: t("auth.error.generic") })
    );
    void navigate({
      to: ".",
      search: (prev) => ({ ...prev, authError: undefined }),
      replace: true
    });
  }, [authError, message, navigate, t]);

  return null;
};

export default AuthErrorToast;
