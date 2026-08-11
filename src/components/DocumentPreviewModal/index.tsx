import { Button, Modal, Spin } from "antd";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import DocumentPreview from "#/components/DocumentPreview";
import { documentFileUrl } from "#/requests/documents";
import type { DocumentDto } from "#/types/Documents";

/**
 * Preview dialog (shared molecule, presentational) wrapping the shared
 * DocumentPreview. The full document (with rawText + sourceFormat) is fetched
 * by the calling page hook and handed in via `doc`.
 */
const DocumentPreviewModal = ({
  open,
  doc,
  loading,
  onClose
}: {
  open: boolean;
  doc: DocumentDto | undefined;
  loading: boolean;
  onClose: () => void;
}) => {
  const { t } = useTranslation();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={doc?.title ?? t("preview.loading")}
      width={900}
      style={{ maxWidth: "95vw" }}
      // Unmount the preview (and its pdf.js worker) when closed — avoids
      // keeping a detached-ArrayBuffer PDF viewer mounted-but-hidden.
      destroyOnHidden
      styles={{ body: { height: "70vh", overflow: "hidden" } }}
      footer={
        doc && doc.sourceFormat !== "text"
          ? [
              <Button
                key="download"
                icon={<Download size={16} />}
                href={documentFileUrl(doc.id, true)}
                download
              >
                {t("preview.download")}
              </Button>,
              <Button key="close" type="primary" onClick={onClose}>
                {t("preview.close")}
              </Button>
            ]
          : [
              <Button key="close" type="primary" onClick={onClose}>
                {t("preview.close")}
              </Button>
            ]
      }
    >
      {loading || !doc ? (
        <div className="flex h-full items-center justify-center">
          <Spin />
        </div>
      ) : (
        <DocumentPreview
          docId={doc.id}
          sourceFormat={doc.sourceFormat}
          rawText={doc.rawText}
        />
      )}
    </Modal>
  );
};

export default DocumentPreviewModal;
