import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateCoverLetterDto } from "./update-cover-letter.dto";

// Mirrors the global ValidationPipe: transform first, then validate.
async function failingProperties(
  body: Record<string, unknown>
): Promise<string[]> {
  const dto = plainToInstance(UpdateCoverLetterDto, body);
  const errors = await validate(dto, { whitelist: true });
  return errors.map((e) => e.property);
}

describe("UpdateCoverLetterDto", () => {
  it.each(["   ", "\n\n", "\t "])(
    "rejects whitespace-only content %j",
    async (content) => {
      expect(await failingProperties({ content })).toEqual(["content"]);
    }
  );

  it("accepts content with surrounding whitespace and keeps it as typed", async () => {
    const dto = plainToInstance(UpdateCoverLetterDto, {
      content: "\nDear team,\n"
    });
    expect(await validate(dto)).toEqual([]);
    expect(dto.content).toBe("\nDear team,\n");
  });

  it("rejects empty and over-long content", async () => {
    expect(await failingProperties({ content: "" })).toEqual(["content"]);
    expect(await failingProperties({ content: "x".repeat(20_001) })).toEqual([
      "content"
    ]);
  });
});
