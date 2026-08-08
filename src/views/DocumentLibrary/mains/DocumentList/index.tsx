import { Button, message, Skeleton } from "antd";
import { Link, useNavigate } from "@tanstack/react-router";
import { SearchX } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import PageContainer from "#/components/PageContainer";
import SectionCard from "#/components/SectionCard";
import { ApiError } from "#/libs/api";
import {
  useDeleteDocument,
  useDocument,
  useRenameDocument,
  useSavedDocuments,
  useSetDocumentParent
} from "#/hooks/useDocuments";
import type { DocumentKind, DocumentSummaryDto } from "#/types/Documents";
import DocumentRow from "../../components/DocumentRow";
import LineageModal from "../../components/LineageModal";
import PreviewModal from "../../components/PreviewModal";
import RenameModal from "../../components/RenameModal";

/**
 * Saved-document library organism: lists the current user's saved CVs or JDs
 * and wires the per-row actions (preview / rename / download / delete) to the
 * documents hooks. Presentational rows + dialogs live under `components/`.
 */
const DocumentList = ({ kind }: { kind: DocumentKind }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  const savedQuery = useSavedDocuments(kind);
  const renameMutation = useRenameDocument();
  const deleteMutation = useDeleteDocument();
  const lineageMutation = useSetDocumentParent();

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<DocumentSummaryDto | null>(
    null
  );
  const [lineageTarget, setLineageTarget] = useState<DocumentSummaryDto | null>(
    null
  );
  const [lineageError, setLineageError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Guarded by a ref, not by the mutation's isPending: a double click fires
  // both presses inside one tick, before React has re-rendered the dialog with
  // its button disabled, so a state flag arrives too late to stop the second.
  const lineageInFlight = useRef(false);

  const previewQuery = useDocument(previewId);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    deleteMutation.mutate(id, {
      onSuccess: () => {
        void messageApi.success(t("library.delete.success"));
      },
      onError: (error) => {
        const inUse = error instanceof ApiError && error.status === 409;
        void messageApi.error(
          t(inUse ? "library.delete.inUse" : "library.delete.failed")
        );
      },
      onSettled: () => setDeletingId(null)
    });
  };

  const handleRename = (title: string) => {
    if (!renameTarget) return;
    renameMutation.mutate(
      { id: renameTarget.id, title },
      {
        onSuccess: () => {
          void messageApi.success(t("library.rename.success"));
          setRenameTarget(null);
        },
        onError: () => {
          void messageApi.error(t("library.rename.failed"));
        }
      }
    );
  };

  // mutateAsync + try/catch rather than mutate's callbacks: those have been
  // observed not to fire in this codebase (see RewriteReview).
  const handleLineage = async (parentId: string | null) => {
    if (!lineageTarget || lineageInFlight.current) return;
    lineageInFlight.current = true;
    setLineageError(null);
    try {
      await lineageMutation.mutateAsync({ id: lineageTarget.id, parentId });
      setLineageTarget(null);
      void messageApi.success(t("library.lineage.success"));
    } catch (error) {
      setLineageError(
        error instanceof ApiError && error.status === 400
          ? t("library.lineage.rejected")
          : t("library.lineage.failed")
      );
    } finally {
      lineageInFlight.current = false;
    }
  };

  const kindKey = kind.toLowerCase() as "cv" | "jd";
  const docs = savedQuery.data ?? [];

  return (
    <PageContainer className="space-y-6">
      {contextHolder}

      <header>
        <h1 className="text-2xl font-bold tracking-tight text-body">
          {t(`library.title.${kindKey}`)}
        </h1>
        {!savedQuery.isLoading && !savedQuery.isError && (
          <p className="mt-1 text-sm text-muted">
            {t("library.subtitle", { count: docs.length })}
          </p>
        )}
      </header>

      {savedQuery.isLoading && <Skeleton active paragraph={{ rows: 4 }} />}

      {savedQuery.isError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {t("library.loadError")}
        </p>
      )}

      {!savedQuery.isLoading && !savedQuery.isError && docs.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line py-16 text-center">
          <SearchX className="text-faint" size={32} />
          <p className="text-sm font-medium text-body">
            {t(`library.empty.${kindKey}`)}
          </p>
          <p className="text-xs text-muted">{t("library.emptyHint")}</p>
          <Link to="/wizard">
            <Button type="primary">{t("library.emptyCta")}</Button>
          </Link>
        </div>
      )}

      {docs.length > 0 && (
        <SectionCard bodyClassName="p-0">
          <ul className="divide-y divide-line">
            {docs.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                deleting={deletingId === doc.id}
                onPreview={() => setPreviewId(doc.id)}
                onRename={() => setRenameTarget(doc)}
                onDelete={() => handleDelete(doc.id)}
                onCompare={() =>
                  void navigate({
                    to: "/compare/$documentId",
                    params: { documentId: doc.id }
                  })
                }
                onSetLineage={() => {
                  setLineageError(null);
                  setLineageTarget(doc);
                }}
              />
            ))}
          </ul>
        </SectionCard>
      )}

      <PreviewModal
        open={previewId !== null}
        doc={previewQuery.data}
        loading={previewQuery.isLoading}
        onClose={() => setPreviewId(null)}
      />

      <RenameModal
        open={renameTarget !== null}
        initialTitle={renameTarget?.title ?? ""}
        confirmLoading={renameMutation.isPending}
        onCancel={() => setRenameTarget(null)}
        onConfirm={handleRename}
      />

      <LineageModal
        open={lineageTarget !== null}
        doc={lineageTarget}
        candidates={docs}
        confirmLoading={lineageMutation.isPending}
        error={lineageError}
        onCancel={() => setLineageTarget(null)}
        onConfirm={(parentId) => void handleLineage(parentId)}
      />
    </PageContainer>
  );
};

export default DocumentList;
