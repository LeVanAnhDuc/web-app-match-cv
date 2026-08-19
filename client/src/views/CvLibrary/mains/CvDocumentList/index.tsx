import DocumentRow from "#/components/DocumentRow";
import SectionCard from "#/components/SectionCard";
import type { DocumentSummaryDto } from "#/types/Documents";

const CvDocumentList = ({
  docs,
  deletingId,
  onPreview,
  onRename,
  onDelete,
  onCompare,
  onSetLineage
}: {
  docs: Array<DocumentSummaryDto>;
  deletingId: string | null;
  onPreview: (doc: DocumentSummaryDto) => void;
  onRename: (doc: DocumentSummaryDto) => void;
  onDelete: (doc: DocumentSummaryDto) => void;
  onCompare: (doc: DocumentSummaryDto) => void;
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
          onCompare={() => onCompare(doc)}
          onSetLineage={() => onSetLineage(doc)}
        />
      ))}
    </ul>
  </SectionCard>
);

export default CvDocumentList;
