import type { CallOptions } from "./http.client";
import type { BaseClient } from "./base.client";

export interface HealthDto {
  status: string;
}

// server/src/modules/health/health.controller.ts — @Public, no DB check (D4: backlog, not a bug).
export function createHealthClient(base: BaseClient) {
  return {
    /** GET /health */
    check: (options?: CallOptions) => base.request<HealthDto>("GET", "/health", options),
  };
}
