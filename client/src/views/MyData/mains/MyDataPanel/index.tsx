import { Alert, Button } from "antd";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionCard from "#/components/SectionCard";
import { useDownloadMyData } from "#/hooks/useMyData";

const MyDataPanel = () => {
  const { t } = useTranslation();
  const {
    mutate: download,
    isPending,
    isError,
    isSuccess
  } = useDownloadMyData();

  const items = [
    t("myData.contents.documents"),
    t("myData.contents.matches"),
    t("myData.contents.credentials")
  ];

  return (
    <>
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-body">
          {t("myData.title")}
        </h1>
        <p className="mt-1 text-sm text-muted">{t("myData.description")}</p>
      </header>
      <SectionCard title={t("myData.contents.heading")}>
        <ul className="list-disc space-y-2 pl-5 text-sm text-body">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SectionCard>
      <Button
        type="primary"
        size="large"
        icon={<Download size={18} />}
        loading={isPending}
        disabled={isPending}
        aria-busy={isPending}
        onClick={() => download()}
      >
        {isPending ? t("myData.downloading") : t("myData.download")}
      </Button>
      <div aria-live="polite">
        {isError && (
          <Alert type="error" role="alert" message={t("myData.error")} />
        )}
        {isSuccess && <Alert type="success" message={t("myData.done")} />}
      </div>
      <p className="text-sm text-muted">{t("myData.privacyNote")}</p>
    </>
  );
};

export default MyDataPanel;
