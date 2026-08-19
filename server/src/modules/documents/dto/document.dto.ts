import { ApiProperty } from "@nestjs/swagger";
import { Document, DocumentKind, SourceFormat } from "@prisma/client";

export class DocumentDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: DocumentKind }) kind: DocumentKind;
  @ApiProperty() title: string;
  @ApiProperty({ enum: SourceFormat }) sourceFormat: SourceFormat;
  @ApiProperty() rawText: string;
  @ApiProperty() isSaved: boolean;

  // Lineage (ADR #15). Set when this document was produced by rewriting
  // another one; null means it is an original.
  @ApiProperty({
    nullable: true,
    description: "id of the document this one is a newer version of"
  })
  parentId: string | null;

  @ApiProperty() createdAt: Date;

  static fromEntity(doc: Document): DocumentDto {
    const dto = new DocumentDto();
    dto.id = doc.id;
    dto.kind = doc.kind;
    dto.title = doc.title;
    dto.sourceFormat = doc.sourceFormat;
    dto.rawText = doc.rawText;
    dto.isSaved = doc.isSaved;
    dto.parentId = doc.parentId;
    dto.createdAt = doc.createdAt;
    return dto;
  }
}
