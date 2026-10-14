import type { CoverLetterDto, GenerateCoverLetterInput, UpdateCoverLetterInput } from "#/types/CoverLetters";
import type { CallOptions } from "./http.client";
import { query, withOptions, type BaseClient, type Loose } from "./base.client";

// server/src/modules/cover-letters/cover-letters.controller.ts. Signed-in only. POST reaches the provider (10/min)
// once the match is found, owned and has a report.
export function createCoverLettersClient(base: BaseClient) {
  return {
    /** POST /cover-letters { matchResultId, tone, length, language, credentialId? } → 201 (status may be failed). */
    generate: (body: Loose<GenerateCoverLetterInput>, options?: CallOptions) =>
      base.request<CoverLetterDto>("POST", "/cover-letters", withOptions({ data: body }, options)),
    /** GET /cover-letters?matchResultId= (required; pass undefined to test its absence). */
    list: (matchResultId: string | undefined, options?: CallOptions) =>
      base.request<CoverLetterDto[]>(
        "GET",
        "/cover-letters",
        withOptions({ params: query({ matchResultId }) }, options)
      ),
    /** PATCH /cover-letters/:id { content } — 1..20000 chars; 400 on a failed letter. A string is sent as { content }. */
    update: (id: string, body: Loose<UpdateCoverLetterInput> | string, options?: CallOptions) =>
      base.request<CoverLetterDto>(
        "PATCH",
        `/cover-letters/${id}`,
        withOptions({ data: typeof body === "string" ? { content: body } : body }, options)
      ),
    /** DELETE /cover-letters/:id → 204. */
    remove: (id: string, options?: CallOptions) => base.request<void>("DELETE", `/cover-letters/${id}`, options),
  };
}
