import type { CallOptions } from "./http.client";
import type { BaseClient } from "./base.client";

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
}

// Swagger, mounted by server/src/main.ts at api/v1/docs (served in every env — D4: backlog, not a bug).
export function createDocsClient(base: BaseClient) {
  return {
    /** GET /docs — Swagger UI (HTML; may answer 301 to /docs/). */
    ui: (options?: CallOptions) => base.request<Buffer>("GET", "/docs", options),
    /** GET /docs-json — the OpenAPI document. */
    json: (options?: CallOptions) => base.request<OpenApiDocument>("GET", "/docs-json", options),
  };
}
