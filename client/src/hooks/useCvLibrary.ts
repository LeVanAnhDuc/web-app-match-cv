import { message } from "antd";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  useDeleteDocument,
  useDocument,
  useRenameDocument,
  useSavedDocuments,
  useSetDocumentParent
} from "#/hooks/useDocuments";
import { ApiError } from "#/libs/api";
import type { DocumentSummaryDto } from "#/types/Documents";

/**
 * Page hook for the saved-CV library (`/cv`): owns the saved-CV query, the
 * per-row mutations (rename / delete / lineage) and the dialog state the
 * CvLibrary view renders. Deliberately CV-only and separate from
 * `useJdLibrary` so the two pages can diverge without touching each other.
 *
 * `contextHolder` must be rendered by the view — that is how antd's message
 * API attaches to the tree.
 */
export function useCvLibrary() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  const savedQuery = useSavedDocuments("CV");
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

  const deleteDoc = (id: string) => {
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

  const confirmRename = (title: string) => {
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
  const confirmLineage = async (parentId: string | null) => {
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

  const openLineage = (doc: DocumentSummaryDto) => {
    setLineageError(null);
    setLineageTarget(doc);
  };

  const compare = (id: string) =>
    void navigate({ to: "/compare/$documentId", params: { documentId: id } });

  return {
    contextHolder,
    docs: savedQuery.data ?? [],
    isLoading: savedQuery.isLoading,
    isError: savedQuery.isError,
    deletingId,
    previewId,
    previewDoc: previewQuery.data,
    previewLoading: previewQuery.isLoading,
    renameTarget,
    renamePending: renameMutation.isPending,
    lineageTarget,
    lineageError,
    lineagePending: lineageMutation.isPending,
    openPreview: setPreviewId,
    closePreview: () => setPreviewId(null),
    openRename: setRenameTarget,
    closeRename: () => setRenameTarget(null),
    confirmRename,
    deleteDoc,
    compare,
    openLineage,
    closeLineage: () => setLineageTarget(null),
    confirmLineage
  };
}
