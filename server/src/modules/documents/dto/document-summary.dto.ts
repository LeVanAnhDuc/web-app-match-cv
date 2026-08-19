import { ApiProperty } from "@nestjs/swagger";
import { Document, DocumentKind, SourceFormat } from "@prisma/client";

export class DocumentSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: DocumentKind }) kind: DocumentKind;
  @ApiProperty() title: string;
  @ApiProperty({ enum: SourceFormat }) sourceFormat: SourceFormat;

  // Present on the summary, not just the detail DTO: the library decides
  // whether to offer "Compare versions" per row, and it only has summaries.
  @ApiProperty({
    nullable: true,
    description: "Lineage — the document this one is a newer version of."
  })
  parentId: string | null;

  @ApiProperty() createdAt: Date;

  static fromEntity(doc: Document): DocumentSummaryDto {
    const dto = new DocumentSummaryDto();
    dto.id = doc.id;
    dto.kind = doc.kind;
    dto.title = doc.title;
    dto.sourceFormat = doc.sourceFormat;
    dto.parentId = doc.parentId;
    dto.createdAt = doc.createdAt;
    return dto;
  }
}
