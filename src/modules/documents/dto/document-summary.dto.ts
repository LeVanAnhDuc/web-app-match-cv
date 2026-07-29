import { ApiProperty } from "@nestjs/swagger";
import { Document, DocumentKind, SourceFormat } from "@prisma/client";

export class DocumentSummaryDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: DocumentKind }) kind: DocumentKind;
  @ApiProperty() title: string;
  @ApiProperty({ enum: SourceFormat }) sourceFormat: SourceFormat;
  @ApiProperty() createdAt: Date;

  static fromEntity(doc: Document): DocumentSummaryDto {
    const dto = new DocumentSummaryDto();
    dto.id = doc.id;
    dto.kind = doc.kind;
    dto.title = doc.title;
    dto.sourceFormat = doc.sourceFormat;
    dto.createdAt = doc.createdAt;
    return dto;
  }
}
