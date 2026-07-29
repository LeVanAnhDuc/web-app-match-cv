import { ApiProperty } from "@nestjs/swagger";
import { Document, DocumentKind, SourceFormat } from "@prisma/client";

export class DocumentDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: DocumentKind }) kind: DocumentKind;
  @ApiProperty() title: string;
  @ApiProperty({ enum: SourceFormat }) sourceFormat: SourceFormat;
  @ApiProperty() rawText: string;
  @ApiProperty() isSaved: boolean;
  @ApiProperty() createdAt: Date;

  static fromEntity(doc: Document): DocumentDto {
    const dto = new DocumentDto();
    dto.id = doc.id;
    dto.kind = doc.kind;
    dto.title = doc.title;
    dto.sourceFormat = doc.sourceFormat;
    dto.rawText = doc.rawText;
    dto.isSaved = doc.isSaved;
    dto.createdAt = doc.createdAt;
    return dto;
  }
}
