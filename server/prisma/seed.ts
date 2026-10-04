// FR-18 (ADR-0022/0023): there is no default user any more — users come from
// Ducker ID sign-in, guests are created on demand. Kept as a valid entry point
// for `prisma db seed`; dev sample data lives in `pnpm seed:mock --user`.
async function main(): Promise<void> {}
void main();
