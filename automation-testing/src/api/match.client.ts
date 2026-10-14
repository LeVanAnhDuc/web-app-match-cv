import type {
  CreateMatchInput,
  CreateMatchRunInput,
  MatchResultDto,
  MatchRunDetailDto,
  MatchRunDto,
  MatchSummaryDto,
} from "#/types/Matching";
import type { CallOptions } from "./http.client";
import { withOptions, type BaseClient, type Loose } from "./base.client";

// server/src/modules/matching/matching.controller.ts. create / createRun / getRun / get are @AllowGuest; list needs a
// signed-in user. POST /match REACHES THE AI PROVIDER once validation, ownership and guest quota pass: plain API specs
// cover only the branches decided before that call (D1); the rest is `@live-ai`.
export function createMatchClient(base: BaseClient) {
  return {
    /** POST /match { cvDocumentId, jdDocumentId, credentialId?, runId? } → 201 MatchResultDto (status may be failed). */
    create: (body: Loose<CreateMatchInput>, options?: CallOptions) =>
      base.request<MatchResultDto>("POST", "/match", withOptions({ data: body }, options)),
    /** GET /match — the caller's match history (summaries). */
    list: (options?: CallOptions) => base.request<MatchSummaryDto[]>("GET", "/match", options),
    /** GET /match/:id */
    get: (id: string, options?: CallOptions) => base.request<MatchResultDto>("GET", `/match/${id}`, options),
    /** POST /match/runs { cvDocumentId, jdDocumentId } → 201 MatchRunDto (no AI call). */
    createRun: (body: Loose<CreateMatchRunInput>, options?: CallOptions) =>
      base.request<MatchRunDto>("POST", "/match/runs", withOptions({ data: body }, options)),
    /** GET /match/runs/:id → the run plus the results that have landed so far. */
    getRun: (id: string, options?: CallOptions) =>
      base.request<MatchRunDetailDto>("GET", `/match/runs/${id}`, options),
  };
}
