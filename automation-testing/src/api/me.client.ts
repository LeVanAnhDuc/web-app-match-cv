import type { CallOptions } from "./http.client";
import type { BaseClient } from "./base.client";

// server/src/modules/me/me.controller.ts. Signed-in only.
export function createMeClient(base: BaseClient) {
  return {
    /** GET /me/export → application/zip (data.json + original uploads), Cache-Control: no-store. Read `raw`. */
    export: (options?: CallOptions) => base.request<Buffer>("GET", "/me/export", options),
  };
}
