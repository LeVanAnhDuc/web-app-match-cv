import type { EnvName } from "./env";

export function buildGrepInvert(env: EnvName, includeFull: boolean): RegExp | undefined {
  const blocked: string[] = [];
  if (!includeFull) blocked.push("@e2e-full");
  if (env === "prd") blocked.push("@creates-data");
  return blocked.length ? new RegExp(blocked.join("|")) : undefined;
}

// Second line of defence: grepInvert can be bypassed by a CLI --grep, this cannot.
export function assertAllowed(env: EnvName, tags: readonly string[]): void {
  if (env === "prd" && tags.includes("@creates-data")) {
    throw new Error("Refusing to run a @creates-data test on prd");
  }
}
