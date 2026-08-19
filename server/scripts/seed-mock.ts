// Dev-only tooling: insert a fixed set of mock CV/JD documents, or remove them.
//
//   yarn seed:mock         insert / refresh the mock documents
//   yarn seed:mock:clean   remove them, and any match produced from them
//
// See docs/specs/seed-mock-documents/design.md. The documents themselves live
// in ./mock-documents.ts; this file owns every database interaction.

import { Prisma, PrismaClient, Role, SourceFormat } from "@prisma/client";
import { STUB_USER_ID } from "../src/common/current-user/current-user.service";
import {
  CV_ID_DIAL,
  JD_ID_DIAL,
  MOCK_DOCUMENTS,
  assertFixturesValid
} from "./mock-documents";

// Deleting is the destructive branch, so it is the one that must be asked for
// explicitly. Bare `yarn seed:mock` inserts.
const CLEAN = process.argv.includes("--clean");

const prisma = new PrismaClient();

async function insert(): Promise<void> {
  // The stub user owns every mock document, and a freshly reset database has no
  // rows at all — so upsert it here rather than assuming `prisma db seed` was
  // run first. Same id and role as prisma/seed.ts, so the two never disagree.
  await prisma.user.upsert({
    where: { id: STUB_USER_ID },
    update: {},
    create: { id: STUB_USER_ID, role: Role.candidate }
  });

  for (const doc of MOCK_DOCUMENTS) {
    const data = {
      userId: STUB_USER_ID,
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
  console.log("Remove them with: yarn seed:mock:clean");
}

async function clean(): Promise<void> {
  // Delete by DIAL, not by the current MOCK_DOCUMENTS id list. Keying on the
  // live list would mean that renumbering or removing a fixture strands the row
  // already in the database: invisible to this command forever, and — sharing
  // STUB_USER_ID with real data — indistinguishable from a real document.
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
  // STUB_USER_ID is deliberately left alone: it is required seed data that
  // CurrentUserService resolves to, not mock data. Deleting it breaks the app.
  console.log("\nMock data removed. Seed it again with: yarn seed:mock");
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
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
