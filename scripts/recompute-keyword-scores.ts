import { PrismaClient } from "@prisma/client";
import {
  MatchingService,
  capForMatch
} from "../src/modules/matching/matching.service";

// Dry-run by default: a bulk data rewrite should require an explicit opt-in.
const APPLY = process.argv.includes("--apply");

const prisma = new PrismaClient();

// keywordScore / combineOverall are pure and never touch the injected
// collaborators, so undefined stand-ins are sufficient — same approach as
// matching.service.spec.ts.
const scoring = new MatchingService(
  undefined as never,
  undefined as never,
  undefined as never,
  undefined as never
);

async function main() {
  const results = await prisma.matchResult.findMany({
    select: {
      id: true,
      semanticScore: true,
      keywordScore: true,
      overallScore: true,
      cvDocument: { select: { rawText: true } },
      jdDocument: { select: { rawText: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  let changed = 0;
  const updates: { id: string; keywordScore: number; overallScore: number }[] =
    [];

  for (const row of results) {
    // The original scores were computed on text already truncated to
    // MAX_MATCH_CHARS (matching.service.ts run()). Applying the same cap is
    // what makes the recomputed value equal to a fresh match's value.
    const keywordScore = scoring.keywordScore(
      capForMatch(row.cvDocument.rawText),
      capForMatch(row.jdDocument.rawText)
    );
    const overallScore = scoring.combineOverall(
      row.semanticScore,
      keywordScore
    );

    if (
      keywordScore === row.keywordScore &&
      overallScore === row.overallScore
    ) {
      continue;
    }

    changed += 1;
    console.log(
      `${row.id}  keyword ${row.keywordScore} -> ${keywordScore}   overall ${row.overallScore} -> ${overallScore}`
    );

    if (APPLY) {
      updates.push({ id: row.id, keywordScore, overallScore });
    }
  }

  if (APPLY && updates.length > 0) {
    // All-or-nothing: a mid-loop exception must never leave some rows on the
    // new formula and others on the old.
    await prisma.$transaction(
      updates.map(({ id, keywordScore, overallScore }) =>
        prisma.matchResult.update({
          where: { id },
          data: { keywordScore, overallScore }
        })
      )
    );
  }

  console.log(
    `\n${results.length} match results scanned, ${changed} would change.`
  );
  console.log(
    APPLY ? "Applied." : "Dry run — pass --apply to write the changes."
  );
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
