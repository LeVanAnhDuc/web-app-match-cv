import { useNavigate, useSearch } from "@tanstack/react-router";
import { message } from "antd";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

// The OAuth callback redirects to `/?authError=<code>`: show one toast for it,
// then strip the param so a reload does not repeat it.
const AuthErrorToast = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // `authError` is not in any route's validated search schema — read it loose.
  const search: Record<string, unknown> = useSearch({ strict: false });
  const authError = search.authError;

  useEffect(() => {
    if (typeof authError !== "string" || !authError) return;
    message.error(
      t(`auth.error.${authError}`, { defaultValue: t("auth.error.generic") })
    );
    void navigate({
      to: ".",
      search: ((s: Record<string, unknown>) => ({
        ...s,
        authError: undefined
      })) as never,
      replace: true
    });
  }, [authError, navigate, t]);

  return null;
};

export default AuthErrorToast;
