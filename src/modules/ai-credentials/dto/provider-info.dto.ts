import { ApiProperty } from "@nestjs/swagger";
import { AiProvider } from "@prisma/client";

/**
 * The provider whitelist and its default models, served so the client does not
 * duplicate the table. Keeping it in one place is why the UI placeholders can
 * never drift from what the engine actually calls.
 */
export class ProviderInfoDto {
  @ApiProperty({ enum: AiProvider }) id: AiProvider;
  @ApiProperty({ example: "OpenRouter" }) label: string;
  @ApiProperty({ example: "openai/gpt-4o-mini" }) defaultChatModel: string;
  @ApiProperty({ example: "openai/text-embedding-3-small" })
  defaultEmbedModel: string;
}
