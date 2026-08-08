import { ApiProperty } from "@nestjs/swagger";
import { AiProvider } from "@prisma/client";

export class DocumentVersionDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({
    description:
      "1 for an original, 2 for its rewrite, and so on. Derived from the parentId chain, not stored."
  })
  version: number;
  @ApiProperty() createdAt: Date;
}

export class ComparisonJdOptionDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() hasBase: boolean;
  @ApiProperty() hasRevision: boolean;
}

/** One side of the comparison: the match that scored that version of the CV. */
export class ComparisonSideDto {
  @ApiProperty() matchResultId: string;
  @ApiProperty() overallScore: number;
  @ApiProperty() semanticScore: number;
  @ApiProperty() keywordScore: number;
  @ApiProperty({ enum: AiProvider }) provider: AiProvider;
  @ApiProperty() chatModel: string;
  @ApiProperty() embedModel: string;
  @ApiProperty({ type: [String] }) gaps: string[];
  @ApiProperty() createdAt: Date;
}

export class ScoreDeltaDto {
  @ApiProperty({ description: "Signed; negative means the score dropped." })
  overall: number;
  @ApiProperty() semantic: number;
  @ApiProperty() keyword: number;
}

export class GapPairDto {
  @ApiProperty() base: string;
  @ApiProperty() revision: string;
}

export class GapDiffDto {
  @ApiProperty({ type: [String] }) closed: string[];
  @ApiProperty({
    type: [GapPairDto],
    description:
      "Still open. Both wordings are kept — how a gap was rephrased is itself a signal."
  })
  persisted: GapPairDto[];
  @ApiProperty({ type: [String] }) introduced: string[];
}

/**
 * How much a CV improved between two versions, on ONE job description.
 *
 * `delta` and `gapDiff` are null together, and only when both versions have a
 * succeeded match on the selected JD. They are never zero-filled: a table of
 * zeroes reads as "no improvement at all", which is a different claim from
 * "this version has not been matched yet".
 *
 * This endpoint never calls an AI provider. See
 * docs/specs/cv-version-comparison/design.md §2.
 */
export class CvComparisonDto {
  @ApiProperty({ type: DocumentVersionDto }) base: DocumentVersionDto;
  @ApiProperty({ type: DocumentVersionDto }) revision: DocumentVersionDto;

  @ApiProperty({
    nullable: true,
    description: "null when neither version has ever been matched."
  })
  jdDocumentId: string | null;

  @ApiProperty({ type: [ComparisonJdOptionDto] })
  jdOptions: ComparisonJdOptionDto[];

  @ApiProperty({ type: ComparisonSideDto, nullable: true })
  baseResult: ComparisonSideDto | null;

  @ApiProperty({ type: ComparisonSideDto, nullable: true })
  revisionResult: ComparisonSideDto | null;

  @ApiProperty({ type: ScoreDeltaDto, nullable: true })
  delta: ScoreDeltaDto | null;

  @ApiProperty({ type: GapDiffDto, nullable: true })
  gapDiff: GapDiffDto | null;

  @ApiProperty({
    description:
      "false means the two reports were written by different chat models, so the gap wording is not comparable. true when there is nothing to warn about."
  })
  sameChatModel: boolean;

  @ApiProperty({
    description:
      "false means the two semantic scores come from different embedding spaces and their difference is not a measure of improvement."
  })
  sameEmbedModel: boolean;
}
