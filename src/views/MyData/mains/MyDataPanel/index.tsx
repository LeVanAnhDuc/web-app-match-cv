import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "antd";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import SectionCard from "#/components/SectionCard";
import { downloadMyData } from "#/requests/myData";

type Status = "idle" | "loading" | "done" | "error";

/**
 * Lets the user download an archive of everything the app stores about them.
 *
 * Deliberately plain: one action, no table, no filters. The description
 * spells out what the archive contains so nobody has to unzip it to find out.
 */
const MyDataPanel = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<Status>("idle");
  // The download resolves after an await, by which point the user may have
  // navigated away — writing state then would warn and leak.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleDownload = async () => {
    setStatus("loading");
    try {
      await downloadMyData();
      if (mounted.current) setStatus("done");
    } catch {
      // The thrown ApiError carries a server message, but it is not
      // translated — show our own copy instead of leaking English to a
      // Vietnamese user.
      if (mounted.current) setStatus("error");
    }
  };

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
        loading={status === "loading"}
        disabled={status === "loading"}
        aria-busy={status === "loading"}
        onClick={() => void handleDownload()}
      >
        {status === "loading" ? t("myData.downloading") : t("myData.download")}
      </Button>

      {/* One live region covers both outcomes — a screen reader user needs to
          hear that the download finished, not only that it started. */}
      <div aria-live="polite">
        {status === "error" && (
          <Alert type="error" role="alert" message={t("myData.error")} />
        )}
        {status === "done" && (
          <Alert type="success" message={t("myData.done")} />
        )}
      </div>

      <p className="text-sm text-muted">{t("myData.privacyNote")}</p>
    </>
  );
};

export default MyDataPanel;
