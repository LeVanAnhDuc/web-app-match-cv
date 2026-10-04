// Dev-only tooling: insert a fixed set of mock CV/JD documents, or remove them.
//
//   pnpm seed:mock --user <email>   insert / refresh the mock documents for a user
//   pnpm seed:mock:clean            remove them, and any match produced from them
//
// There is no default user any more (ADR-0022): the target must already exist,
// i.e. have signed in once through Ducker ID with that email.
//
// See docs/specs/seed-mock-documents/design.md. The documents themselves live
// in ./mock-documents.ts; this file owns every database interaction.

import { Prisma, PrismaClient, SourceFormat } from "@prisma/client";
import {
  CV_ID_DIAL,
  JD_ID_DIAL,
  MOCK_DOCUMENTS,
  assertFixturesValid
} from "./mock-documents";

// Deleting is the destructive branch, so it is the one that must be asked for
// explicitly. Bare `pnpm seed:mock` inserts.
const CLEAN = process.argv.includes("--clean");

const prisma = new PrismaClient();

class UsageError extends Error {}

function readUserEmail(): string | null {
  const i = process.argv.indexOf("--user");
  const value = i === -1 ? undefined : process.argv[i + 1];
  return value && !value.startsWith("--") ? value : null;
}

async function insert(): Promise<void> {
  const email = readUserEmail();
  if (!email) {
    throw new UsageError("Usage: pnpm seed:mock --user <email>");
  }

  // Never create the user here: real users come from Ducker ID sign-in, and a
  // row invented by this script would have no externalSub to sign in with.
  const user = await prisma.user.findFirst({
    where: { email, isGuest: false }
  });
  if (!user) {
    throw new UsageError(
      `No signed-in user with email "${email}". Sign in once through Ducker ID with that email first.`
    );
  }

  for (const doc of MOCK_DOCUMENTS) {
    const data = {
      userId: user.id,
      kind: doc.kind,
      title: doc.title,
      sourceFormat: SourceFormat.text,
      rawText: doc.rawText,
      isSaved: true,
      // Explicit nulls, not omissions: this is the RESET half of the command.
      // Omitting them would let values from a previous run survive.
      fileData: null,
      fileMime: null,
      // Prisma.DbNull, not null: for a nullable Json column Prisma keeps SQL
      // NULL and JSON `null` apart, and only DbNull means "no value".
      parsedContent: Prisma.DbNull,
      parentId: null
    };

    // Full `update`, not `update: {}`: re-running is meant to restore a mock to
    // its pristine state even after it was renamed or edited through the UI.
    // That would be wrong for real data; for mock data it is the point.
    await prisma.document.upsert({
      where: { id: doc.id },
      update: data,
      create: { id: doc.id, ...data }
    });

    console.log(
      `  ${doc.label}  ${doc.kind}  ${doc.language}  ${String(doc.rawText.length).padStart(5)} chars  ${doc.title}`
    );
  }

  console.log(`\n${MOCK_DOCUMENTS.length} mock documents seeded.`);
  console.log("Remove them with: pnpm seed:mock:clean");
}

async function clean(): Promise<void> {
  // Delete by DIAL, not by the current MOCK_DOCUMENTS id list. Keying on the
  // live list would mean that renumbering or removing a fixture strands the row
  // already in the database: invisible to this command forever, and
  // indistinguishable from a real document of the same owner.
  // The dial is still 24 fixed characters of a UUID, so it cannot collide with
  // a real document's generated id.
  const isMockId = [
    { id: { startsWith: CV_ID_DIAL } },
    { id: { startsWith: JD_ID_DIAL } }
  ];
  // Reused verbatim by both match tables: a row is mock-derived if EITHER side
  // of the pair is a mock document.
  const referencesMock = {
    OR: [{ cvDocument: { OR: isMockId } }, { jdDocument: { OR: isMockId } }]
  };

  // One transaction: a failure partway through must not leave the database with
  // the matches gone but the documents still present, or the reverse.
  //
  // The order is forced by the schema, not chosen. MatchResult and MatchRun
  // both reach Document through a REQUIRED relation with no onDelete, which
  // Postgres defaults to RESTRICT — so deleting the documents first is refused
  // outright once a mock has ever been matched. CoverLetter needs no step of
  // its own: it cascades from MatchResult (onDelete: Cascade).
  const [matchResults, matchRuns, documents] = await prisma.$transaction([
    prisma.matchResult.deleteMany({ where: referencesMock }),
    prisma.matchRun.deleteMany({ where: referencesMock }),
    prisma.document.deleteMany({ where: { OR: isMockId } })
  ]);

  console.log(`  match results removed : ${matchResults.count}`);
  console.log(`  match runs removed    : ${matchRuns.count}`);
  console.log(`  documents removed     : ${documents.count}`);
  // Users are left alone: they are real accounts, never created by this script.
  console.log("\nMock data removed. Seed it again with: pnpm seed:mock");
}

async function main(): Promise<void> {
  assertFixturesValid();
  if (CLEAN) {
    await clean();
  } else {
    await insert();
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e instanceof UsageError ? e.message : e);
    await prisma.$disconnect();
    process.exit(1);
  });
