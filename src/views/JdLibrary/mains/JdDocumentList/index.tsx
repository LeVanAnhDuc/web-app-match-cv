import DocumentRow from "#/components/DocumentRow";
import SectionCard from "#/components/SectionCard";
import type { DocumentSummaryDto } from "#/types/Documents";

/**
 * The saved-JD rows themselves. Purely a layout organism: every action is
 * handed down from the JdLibrary view, which owns them through `useJdLibrary`.
 *
 * No compare action here — version comparison only accepts a CV
 * (docs/specs/cv-version-comparison/security-report.md).
 */
const JdDocumentList = ({
  docs,
  deletingId,
  onPreview,
  onRename,
  onDelete,
  onSetLineage
}: {
  docs: Array<DocumentSummaryDto>;
  deletingId: string | null;
  onPreview: (doc: DocumentSummaryDto) => void;
  onRename: (doc: DocumentSummaryDto) => void;
  onDelete: (doc: DocumentSummaryDto) => void;
  onSetLineage: (doc: DocumentSummaryDto) => void;
}) => (
  <SectionCard bodyClassName="p-0">
    <ul className="divide-y divide-line">
      {docs.map((doc) => (
        <DocumentRow
          key={doc.id}
          doc={doc}
          deleting={deletingId === doc.id}
          onPreview={() => onPreview(doc)}
          onRename={() => onRename(doc)}
          onDelete={() => onDelete(doc)}
          onSetLineage={() => onSetLineage(doc)}
        />
      ))}
    </ul>
  </SectionCard>
);

export default JdDocumentList;
