import { ApiProperty } from "@nestjs/swagger";
import { AiProvider } from "@prisma/client";
import { IsEnum, IsOptional, IsString, Length, Matches } from "class-validator";

// A key pasted from a provider console never contains whitespace; rejecting it
// also stops a newline from being smuggled into an outgoing request header.
export const NO_WHITESPACE = /^\S+$/;
export const API_KEY_MIN_LENGTH = 20;
export const API_KEY_MAX_LENGTH = 400;
export const LABEL_MAX_LENGTH = 60;
export const MODEL_MAX_LENGTH = 120;

export class CreateAiCredentialDto {
  @ApiProperty({ enum: AiProvider })
  @IsEnum(AiProvider)
  provider: AiProvider;

  @ApiProperty({
    description: "User-chosen name. Must be unique among your credentials.",
    example: "My OpenRouter key"
  })
  @IsString()
  @Length(1, LABEL_MAX_LENGTH)
  label: string;

  @ApiProperty({
    writeOnly: true,
    description:
      "Provider API key. Stored encrypted; no endpoint ever returns it.",
    example: "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
  })
  @IsString()
  @Length(API_KEY_MIN_LENGTH, API_KEY_MAX_LENGTH)
  @Matches(NO_WHITESPACE, { message: "apiKey must not contain whitespace" })
  apiKey: string;

  // Blank is ALLOWED and meaningful: it means "use the provider default", and
  // on PATCH it is how an existing override gets cleared. The service trims and
  // stores blank as null. No no-whitespace rule here — unlike apiKey these
  // values go into a JSON body, and a bad model name simply comes back from the
  // provider as model_unavailable, which is the feedback path by design.
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
