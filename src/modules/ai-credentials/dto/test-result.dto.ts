import { ApiProperty } from "@nestjs/swagger";
import { AiTestStatus } from "@prisma/client";

/**
 * Outcome of a connection test. The hybrid engine needs chat AND embeddings,
 * so both are reported separately — a key that can chat but cannot embed is a
 * real and otherwise invisible failure mode. `status` is the worse of the two
 * and is what gets persisted on the credential.
 */
export class TestResultDto {
  @ApiProperty({ enum: AiTestStatus, description: "Worse of chat and embed" })
  status: AiTestStatus;

  @ApiProperty({ enum: AiTestStatus }) chat: AiTestStatus;
  @ApiProperty({ enum: AiTestStatus }) embed: AiTestStatus;
  @ApiProperty() testedAt: Date;
}
