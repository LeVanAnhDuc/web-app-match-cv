import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsString, MaxLength, MinLength } from "class-validator";

function trimIfString({ value }: { value: unknown }): unknown {
  return typeof value === "string" ? value.trim() : value;
}

export class UpdateDocumentDto {
  @ApiProperty({ maxLength: 200 })
  @Transform(trimIfString)
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;
}
