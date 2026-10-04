// Side-effect import: must run BEFORE AppModule is imported, because
// ConfigModule.forRoot() validates process.env at decoration time.
const OVERRIDES: Record<string, string> = {
  CLIENT_ORIGIN: "http://localhost:5300",
  OIDC_ISSUER: "http://idp.test",
  SESSION_SECRET: "e2e-auth-flow-secret-".padEnd(32, "x")
};

const previous = Object.fromEntries(
  Object.keys(OVERRIDES).map((k) => [k, process.env[k]])
);
Object.assign(process.env, OVERRIDES);

/** Puts back what this module changed, so no later suite in the worker inherits it. */
export function restoreAuthFlowEnv(): void {
  for (const [k, v] of Object.entries(previous)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}
