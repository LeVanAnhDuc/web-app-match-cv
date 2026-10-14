import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CreateAiCredentialDto } from "./create-ai-credential.dto";
import { UpdateAiCredentialDto } from "./update-ai-credential.dto";

const API_KEY = "sk-plaintext-key-000000";
const LABEL_60 = "p".repeat(60);

// Mirrors the global ValidationPipe: transform first, then validate.
async function errorsFor<T extends object>(
  cls: new () => T,
  body: Record<string, unknown>
): Promise<{ dto: T; fields: string[] }> {
  const dto = plainToInstance(cls, body);
  const errors = await validate(dto, { whitelist: true });
  return { dto, fields: errors.map((e) => e.property) };
}

describe.each([
  [
    "CreateAiCredentialDto",
    CreateAiCredentialDto,
    { provider: "openrouter", apiKey: API_KEY }
  ],
  ["UpdateAiCredentialDto", UpdateAiCredentialDto, {}]
] as const)("%s label", (_name, cls, base) => {
  it("rejects a whitespace-only label", async () => {
    const { fields } = await errorsFor(cls, { ...base, label: "   " });
    expect(fields).toContain("label");
  });

  it("trims before checking the 60-character limit", async () => {
    const { dto, fields } = await errorsFor(cls, {
      ...base,
      label: ` ${LABEL_60} `
    });
    expect(fields).not.toContain("label");
    expect(dto.label).toBe(LABEL_60);
  });
});
