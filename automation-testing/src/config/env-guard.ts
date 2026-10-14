import type { EnvName } from "./env";

export interface GrepFlags {
  /** FULL=1: include @e2e-full. */
  includeFull?: boolean;
  /** LIVE_AI=1: include @live-ai (calls the real AI provider — costs money). */
  liveAi?: boolean;
}

/** Tags a normal run filters out. `flags` may be a boolean for the old `(env, includeFull)` call. */
export function buildGrepInvert(env: EnvName, flags: GrepFlags | boolean = {}): RegExp | undefined {
  const { includeFull = false, liveAi = false } = typeof flags === "boolean" ? { includeFull: flags } : flags;
  const blocked: string[] = [];
  if (!includeFull) blocked.push("@e2e-full");
  if (!liveAi) blocked.push("@live-ai");
  if (env === "prd") blocked.push("@creates-data");
  return blocked.length ? new RegExp(blocked.join("|")) : undefined;
}

/** Reads the grep flags from the environment (`FULL=1`, `LIVE_AI=1`). */
export function grepFlagsFrom(source: NodeJS.ProcessEnv = process.env): Required<GrepFlags> {
  return { includeFull: source.FULL?.trim() === "1", liveAi: source.LIVE_AI?.trim() === "1" };
}

// Second line of defence: grepInvert can be bypassed by a CLI --grep, this cannot.
export function assertAllowed(
  env: EnvName,
  tags: readonly string[],
  source: NodeJS.ProcessEnv = process.env
): void {
  if (env === "prd" && tags.includes("@creates-data")) {
    throw new Error("Refusing to run a @creates-data test on prd");
  }
  if (tags.includes("@live-ai") && !grepFlagsFrom(source).liveAi) {
    throw new Error("Refusing to run a @live-ai test without LIVE_AI=1 (it calls the paid AI provider)");
  }
}
