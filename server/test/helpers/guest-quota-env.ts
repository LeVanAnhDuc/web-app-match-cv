// Side-effect import: must run BEFORE AppModule is imported, because
// ConfigModule.forRoot() validates process.env at decoration time.
process.env.GUEST_MATCH_LIMIT_PER_DAY = "1";
process.env.SESSION_SECRET ??= "e2e-secret-".padEnd(32, "x");
