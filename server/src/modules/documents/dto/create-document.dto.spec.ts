import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { I18nContext } from "nestjs-i18n";
import { CreateDocumentDto } from "./create-document.dto";

// Mirrors the global ValidationPipe: transform first, then validate.
async function messagesFor(
  body: Record<string, unknown>
): Promise<Record<string, string[]>> {
  const dto = plainToInstance(CreateDocumentDto, body);
  const errors = await validate(dto, { whitelist: true });
  return Object.fromEntries(
    errors.map((e) => [e.property, Object.values(e.constraints ?? {})])
  );
}

const VALID = { kind: "JD", save: "true", title: "T", sourceText: "JD" };

describe("CreateDocumentDto messages", () => {
  afterEach(() => jest.restoreAllMocks());

  it("translates validation errors through the request's i18n context", async () => {
    jest.spyOn(I18nContext, "current").mockReturnValue({
      t: (key: string) => `vi:${key}`
    } as unknown as I18nContext);

    const messages = await messagesFor({
      ...VALID,
      kind: "RESUME",
      title: "T".repeat(201),
      sourceText: "x".repeat(100_001)
    });

    expect(messages).toEqual({
      kind: ["vi:documents.errors.invalidKind"],
      title: ["vi:documents.errors.titleTooLong"],
      sourceText: ["vi:documents.errors.textTooLong"]
    });
  });

  it("falls back to English outside a request", async () => {
    const messages = await messagesFor({ ...VALID, title: "T".repeat(201) });
    expect(messages.title).toEqual(["Title must be at most 200 characters."]);
  });

  it("accepts the boundaries: 200-character title, 100 000-character text", async () => {
    const messages = await messagesFor({
      ...VALID,
      title: "T".repeat(200),
      sourceText: "x".repeat(100_000)
    });
    expect(messages).toEqual({});
  });
});
