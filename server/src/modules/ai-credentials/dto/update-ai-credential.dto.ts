import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Length, Matches } from "class-validator";
import {
  API_KEY_MAX_LENGTH,
  API_KEY_MIN_LENGTH,
  LABEL_MAX_LENGTH,
  MODEL_MAX_LENGTH,
  NO_WHITESPACE
} from "./create-ai-credential.dto";

/**
 * `provider` is deliberately absent: it is immutable. Changing it would leave
 * the stored model overrides pointing at names the new provider does not have.
 * Switch provider by creating a second credential.
 */
export class UpdateAiCredentialDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Length(1, LABEL_MAX_LENGTH)
  label?: string;

  @ApiProperty({
    required: false,
    writeOnly: true,
    description: "Omit to keep the stored key.",
    example: "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
  })
  @IsOptional()
  @IsString()
  @Length(API_KEY_MIN_LENGTH, API_KEY_MAX_LENGTH)
  @Matches(NO_WHITESPACE, { message: "apiKey must not contain whitespace" })
  apiKey?: string;

  @ApiProperty({
    required: false,
    description: "Leave blank to use the provider default."
  })
  @IsOptional()
  @IsString()
  @Length(0, MODEL_MAX_LENGTH)
  chatModel?: string;

  @ApiProperty({
    required: false,
    description: "Leave blank to use the provider default."
  })
  @IsOptional()
  @IsString()
  @Length(0, MODEL_MAX_LENGTH)
  embedModel?: string;
}
