import { Skeleton } from "antd";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import PageContainer from "#/components/PageContainer";
import SectionCard from "#/components/SectionCard";
import SignInGate from "#/components/SignInGate";
import { useAuth } from "#/hooks/useAuth";

/**
 * Children render for users only, so a guest never fires the page's queries
 * (they would 401). `loading` is also what the server renders, which keeps
 * the first client render identical to the SSR markup.
 */
const RequireAuth = ({
  titleKey,
  children
}: {
  titleKey: string;
  children: ReactNode;
}) => {
  const { t } = useTranslation();
  const { status, isUser } = useAuth();

  if (isUser) return <>{children}</>;

  if (status === "loading") {
    return (
      <div aria-busy="true">
        <PageContainer>
          <SectionCard>
            <Skeleton active paragraph={{ rows: 4 }} />
          </SectionCard>
        </PageContainer>
      </div>
    );
  }

  return (
    <PageContainer>
      <SignInGate
        variant="route"
        title={t(titleKey)}
        description={t("gate.description")}
        backTo="/wizard"
      />
    </PageContainer>
  );
};

export default RequireAuth;
