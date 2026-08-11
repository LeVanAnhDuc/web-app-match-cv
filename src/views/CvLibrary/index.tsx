import { Skeleton } from "antd";
import DocumentLineageModal from "#/components/DocumentLineageModal";
import DocumentPreviewModal from "#/components/DocumentPreviewModal";
import DocumentRenameModal from "#/components/DocumentRenameModal";
import PageContainer from "#/components/PageContainer";
import { useCvLibrary } from "#/hooks/useCvLibrary";
import CvDocumentList from "./mains/CvDocumentList";
import CvLibraryEmpty from "./mains/CvLibraryEmpty";
import CvLibraryError from "./mains/CvLibraryError";
import CvLibraryHeader from "./mains/CvLibraryHeader";

/**
 * Saved-CV library page (`/cv`) — lists the current user's saved CVs with
 * preview / rename / compare / lineage / download / delete. State and actions
 * come from `useCvLibrary`; this shell only decides which state to show.
 * Mock: docs/ui-designs/home-dashboard-library/library-cv.html.
 */
const CvLibrary = () => {
  const library = useCvLibrary();
  const settled = !library.isLoading && !library.isError;

  return (
    <PageContainer className="space-y-6">
      {library.contextHolder}

      <CvLibraryHeader count={settled ? library.docs.length : null} />

      {library.isLoading && <Skeleton active paragraph={{ rows: 4 }} />}
      {library.isError && <CvLibraryError />}
      {settled && library.docs.length === 0 && <CvLibraryEmpty />}

      {library.docs.length > 0 && (
        <CvDocumentList
          docs={library.docs}
          deletingId={library.deletingId}
          onPreview={(doc) => library.openPreview(doc.id)}
          onRename={(doc) => library.openRename(doc)}
          onDelete={(doc) => library.deleteDoc(doc.id)}
          onCompare={(doc) => library.compare(doc.id)}
          onSetLineage={(doc) => library.openLineage(doc)}
        />
      )}

      <DocumentPreviewModal
        open={library.previewId !== null}
        doc={library.previewDoc}
        loading={library.previewLoading}
        onClose={library.closePreview}
      />

      <DocumentRenameModal
        open={library.renameTarget !== null}
        initialTitle={library.renameTarget?.title ?? ""}
        confirmLoading={library.renamePending}
        onCancel={library.closeRename}
        onConfirm={library.confirmRename}
      />

      <DocumentLineageModal
        open={library.lineageTarget !== null}
        doc={library.lineageTarget}
        candidates={library.docs}
        confirmLoading={library.lineagePending}
        error={library.lineageError}
        onCancel={library.closeLineage}
        onConfirm={(parentId) => void library.confirmLineage(parentId)}
      />
    </PageContainer>
  );
};

export default CvLibrary;
