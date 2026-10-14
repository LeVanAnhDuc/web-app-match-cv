// Constants and generators for test input. No .env, no network: values only.

// Unique per call so parallel tests never collide on the same address.
export function randomEmail(prefix = "qa"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}
