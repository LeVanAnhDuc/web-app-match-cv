import { ApiProperty } from "@nestjs/swagger";
import { AiProvider } from "@prisma/client";
import type { GroundedChange } from "../grounding";

export class CvRewriteChangeDto {
  @ApiProperty({ description: "Stable only within this proposal." })
  id: string;

  @ApiProperty({
    nullable: true,
    description:
      "Model-suggested label used for grouping in the UI only. It takes part in no check."
  })
  sectionHint: string | null;

  @ApiProperty({
    description:
      "The excerpt as it appears in the CV today — already verified to exist there verbatim."
  })
  original: string;

  @ApiProperty({ description: "Empty string means: remove the excerpt." })
  replacement: string;

  @ApiProperty() rationale: string;

  @ApiProperty({
    nullable: true,
    description: "Which reported gap this closes."
  })
  addressesGap: string | null;

  static fromGrounded(change: GroundedChange): CvRewriteChangeDto {
    const dto = new CvRewriteChangeDto();
    dto.id = change.id;
    dto.sectionHint = change.sectionHint;
    dto.original = change.original;
    dto.replacement = change.replacement;
    dto.rationale = change.rationale;
    dto.addressesGap = change.addressesGap;
    return dto;
  }
}

/**
 * A proposal is NOT persisted (ADR #13: the output only becomes real data once
 * the user approves it), so it carries no id of its own and reloading the page
 * means generating again.
 */
export class CvRewriteProposalDto {
  @ApiProperty() matchResultId: string;
  @ApiProperty() cvDocumentId: string;
  @ApiProperty() cvTitle: string;
  @ApiProperty({ enum: AiProvider }) provider: AiProvider;
  @ApiProperty() chatModel: string;
  @ApiProperty({ type: [CvRewriteChangeDto] }) changes: CvRewriteChangeDto[];

  @ApiProperty({
    type: [String],
    description:
      "Gaps that cannot be closed by rewording. Reported rather than invented (ADR #13)."
  })
  unaddressedGaps: string[];

  static from(input: {
    matchResultId: string;
    cvDocumentId: string;
    cvTitle: string;
    provider: AiProvider;
    chatModel: string;
    changes: GroundedChange[];
    unaddressedGaps: string[];
  }): CvRewriteProposalDto {
    const dto = new CvRewriteProposalDto();
    dto.matchResultId = input.matchResultId;
    dto.cvDocumentId = input.cvDocumentId;
    dto.cvTitle = input.cvTitle;
    dto.provider = input.provider;
    dto.chatModel = input.chatModel;
    dto.changes = input.changes.map((change) =>
      CvRewriteChangeDto.fromGrounded(change)
    );
    dto.unaddressedGaps = input.unaddressedGaps;
    return dto;
  }
}
