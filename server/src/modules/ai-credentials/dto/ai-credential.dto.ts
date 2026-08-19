import { ApiProperty } from "@nestjs/swagger";
import { AiCredential, AiProvider, AiTestStatus } from "@prisma/client";

/**
 * Read model for a stored credential.
 *
 * There is deliberately NO field for `encryptedKey` / `keyIv` / `keyTag`:
 * those three columns must never leave the service layer. `keyLast4` exists
 * only so the UI can show which key a row refers to.
 */
export class AiCredentialDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: AiProvider }) provider: AiProvider;
  @ApiProperty() label: string;

  @ApiProperty({
    description: "Last 4 characters only — not enough to reuse the key.",
    example: "1234"
  })
  keyLast4: string;

  @ApiProperty({ nullable: true, description: "null = provider default" })
  chatModel: string | null;

  @ApiProperty({ nullable: true, description: "null = provider default" })
  embedModel: string | null;

  @ApiProperty({ enum: AiTestStatus, nullable: true })
  lastTestStatus: AiTestStatus | null;

  @ApiProperty({ nullable: true }) lastTestedAt: Date | null;
  @ApiProperty({ nullable: true }) lastUsedAt: Date | null;
  @ApiProperty() createdAt: Date;

  static fromEntity(entity: AiCredential): AiCredentialDto {
    const dto = new AiCredentialDto();
    dto.id = entity.id;
    dto.provider = entity.provider;
    dto.label = entity.label;
    dto.keyLast4 = entity.keyLast4;
    dto.chatModel = entity.chatModel;
    dto.embedModel = entity.embedModel;
    dto.lastTestStatus = entity.lastTestStatus;
    dto.lastTestedAt = entity.lastTestedAt;
    dto.lastUsedAt = entity.lastUsedAt;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
