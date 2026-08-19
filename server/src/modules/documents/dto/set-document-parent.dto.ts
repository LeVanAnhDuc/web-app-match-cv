import { ApiProperty } from "@nestjs/swagger";
import { IsUUID, ValidateIf } from "class-validator";

/**
 * Declare (or clear) which document this one is a newer version of — the
 * manual half of Goal 9's lineage. The rewrite assistant sets `parentId` for
 * the CVs it produces; this is how a hand-edited upload gets the same link.
 *
 * A sub-resource of its own rather than a field on UpdateDocumentDto, whose
 * `title` is required: folding it in there would force every lineage edit to
 * resend a title and would change the contract of the rename flow.
 */
export class SetDocumentParentDto {
  @ApiProperty({
    nullable: true,
    description: "null clears the link, which is how a wrong one is undone."
  })
  // Only validated as a UUID when it is not the explicit null.
  @ValidateIf((dto: SetDocumentParentDto) => dto.parentId !== null)
  @IsUUID()
  parentId!: string | null;
}
