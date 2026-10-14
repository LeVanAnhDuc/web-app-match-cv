import { randomUUID } from "node:crypto";
import { test, expect } from "@/fixtures";
import { serverMessage } from "@/data/copy";
import {
  API_BULLET,
  API_REWORDED,
  CV_TEXT,
  FABRICATION,
  MIGRATION_BULLET,
  PATTERN_REPLACEMENT,
  numberedCv,
} from "@/data/test-data/cv-rewrite-assistant";

// POST /cv-rewrite/accept calls no provider, so every branch runs live (D1). It re-runs the SAME grounding rules as
// generation (grounding.ts applyChanges ↔ groundChanges), against the CV read from the database — which is how the
// anchor boundaries (12 chars, unique, overlap, 4×, 1500, whitespace) are proven deterministically (REQ-16/17/26/27).
// Accept is throttled at 20/60s; the suite's http client waits a throttler 429 out, so this file may pause.

type Change = { original: string; replacement: string };

const body = (matchResultId: string, changes: Change[], title = "Improved CV") => ({ matchResultId, title, changes });

/** Literal replacement of the first occurrence (a function, so `$&` stays text — like the server's splice). */
const applied = (text: string, original: string, replacement: string) => text.replace(original, () => replacement);

/** Markers of server internals that must never reach a client (REQ-35). */
const INTERNALS = [
  /\bstack\b/i,
  /\bat .+\.(?:ts|js):\d+/,
  /prisma/i,
  /"(?:Document|MatchResult|MatchRun|AiCredential|User|Session)"/,
  /encryptedKey|keyIv|keyTag|apiKey/,
];

test.describe("cv rewrite — accept", () => {
  test(
    "lưu tạo CV mới liên kết CV gốc và không đụng CV gốc",
    { tag: ["@TC-CVREWRITEASSISTANT-009", "@smoke", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId });
      const before = await rewriteData.document(seed.cvId);

      const res = await me.api.cvRewrite.accept(
        body(seed.matchId, [{ original: API_BULLET, replacement: API_REWORDED }], "My CV (improved)")
      );

      expect(res.status).toBe(201);
      const created = res.json();
      expect(created).toMatchObject({
        title: "My CV (improved)",
        kind: "CV",
        sourceFormat: "text",
        isSaved: true,
        parentId: seed.cvId,
      });
      expect(created.rawText).toBe(applied(CV_TEXT, API_BULLET, API_REWORDED));
      expect(created.rawText).toContain(`- ${MIGRATION_BULLET}`);

      const row = await rewriteData.document(created.id);
      expect(row).toMatchObject({ userId: me.userId, parentId: seed.cvId, fileData: null, fileMime: null, isSaved: true });

      // The original is never overwritten (ADR-0013) and stays a root.
      const after = await rewriteData.document(seed.cvId);
      expect(after?.rawText).toBe(before?.rawText);
      expect(after?.rawText).toBe(CV_TEXT);
      expect(after?.parentId).toBeNull();
    }
  );

  test(
    "chỉ đoạn được duyệt bị thay, xoá dòng và ký tự $ giữ nguyên văn",
    { tag: ["@TC-CVREWRITEASSISTANT-010", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId });

      const res = await me.api.cvRewrite.accept(
        body(seed.matchId, [
          { original: API_BULLET, replacement: PATTERN_REPLACEMENT },
          { original: MIGRATION_BULLET, replacement: "" },
        ])
      );

      expect(res.status).toBe(201);
      expect(res.json().rawText).toBe(applied(applied(CV_TEXT, API_BULLET, PATTERN_REPLACEMENT), MIGRATION_BULLET, ""));
    }
  );

  test(
    "thay đổi không bám CV bị từ chối và không tạo gì",
    { tag: ["@TC-CVREWRITEASSISTANT-011", "@smoke", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId });

      const res = await me.api.cvRewrite.accept(
        body(seed.matchId, [{ original: FABRICATION, replacement: `${FABRICATION} (CKA).` }], "Forged CV")
      );

      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("cvRewrite.errors.changeNotGrounded"));
      expect(await rewriteData.childrenOf(seed.cvId)).toHaveLength(0);
    }
  );

  test(
    "đoạn neo xuất hiện hai lần bị từ chối",
    { tag: ["@TC-CVREWRITEASSISTANT-012", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId, cvText: `${CV_TEXT}\n- ${API_BULLET}` });

      const res = await me.api.cvRewrite.accept(body(seed.matchId, [{ original: API_BULLET, replacement: API_REWORDED }]));

      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("cvRewrite.errors.changeNotGrounded"));
      expect(await rewriteData.childrenOf(seed.cvId)).toHaveLength(0);
    }
  );

  test(
    "neo 11 ký tự bị từ chối, 12 ký tự được nhận",
    { tag: ["@TC-CVREWRITEASSISTANT-013", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId });
      const eleven = "billing sys";
      const twelve = "billing syst";
      expect(eleven).toHaveLength(11);
      expect(twelve).toHaveLength(12);

      const short = await me.api.cvRewrite.accept(body(seed.matchId, [{ original: eleven, replacement: "billing platform" }]));
      expect(short.status).toBe(400);
      expect(short.error().message).toBe(serverMessage("cvRewrite.errors.changeNotGrounded"));

      const atLimit = await me.api.cvRewrite.accept(body(seed.matchId, [{ original: twelve, replacement: "billing platform" }]));
      expect(atLimit.status).toBe(201);
      expect(atLimit.json().rawText).toBe(applied(CV_TEXT, twelve, "billing platform"));
    }
  );

  test(
    "neo khác whitespace vẫn khớp và chỉ thay đúng đoạn nguyên văn",
    { tag: ["@TC-CVREWRITEASSISTANT-014", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const replacement = "Split a monolith into three services and halved deploy time.";

      // (a) the client's anchor is re-wrapped; the CV is not.
      const plain = await rewriteData.match({ userId: me.userId });
      const rewrapped = "Led the migration of a monolith\n   to three  services, cutting deploy time.";
      const a = await me.api.cvRewrite.accept(body(plain.matchId, [{ original: rewrapped, replacement }]));
      expect(a.status).toBe(201);
      expect(a.json().rawText).toBe(applied(CV_TEXT, MIGRATION_BULLET, replacement));

      // (b) the CV is wrapped (PDF extraction); the anchor is one clean line. Exactly the CV's own span is replaced.
      const wrappedSpan = "Built REST APIs  with\n  Node.js and Express for an internal billing system.";
      const wrappedCv = `EXPERIENCE\n- ${wrappedSpan}\n- ${MIGRATION_BULLET}`;
      const wrapped = await rewriteData.match({ userId: me.userId, cvText: wrappedCv });
      const b = await me.api.cvRewrite.accept(body(wrapped.matchId, [{ original: API_BULLET, replacement: API_REWORDED }]));
      expect(b.status).toBe(201);
      expect(b.json().rawText).toBe(applied(wrappedCv, wrappedSpan, API_REWORDED));
    }
  );

  test(
    "hai thay đổi chồng lấn bị từ chối",
    { tag: ["@TC-CVREWRITEASSISTANT-015", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId });

      const res = await me.api.cvRewrite.accept(
        body(seed.matchId, [
          { original: API_BULLET, replacement: "Built REST APIs." },
          { original: "REST APIs with Node.js and Express", replacement: "REST APIs with Node.js" },
        ])
      );

      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("cvRewrite.errors.changesOverlap"));
      expect(await rewriteData.childrenOf(seed.cvId)).toHaveLength(0);
    }
  );

  test(
    "đoạn thay dài đúng 4 lần neo được nhận, dài hơn bị từ chối",
    { tag: ["@TC-CVREWRITEASSISTANT-016", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId });
      const budget = API_BULLET.length * 4;

      const atLimit = await me.api.cvRewrite.accept(
        body(seed.matchId, [{ original: API_BULLET, replacement: "x".repeat(budget) }])
      );
      expect(atLimit.status).toBe(201);

      const over = await me.api.cvRewrite.accept(
        body(seed.matchId, [{ original: API_BULLET, replacement: "x".repeat(budget + 1) }])
      );
      expect(over.status).toBe(400);
      expect(over.error().message).toBe(serverMessage("cvRewrite.errors.changeTooLong"));
    }
  );

  test(
    "đoạn thay 1500 ký tự được nhận, 1501 bị từ chối",
    { tag: ["@TC-CVREWRITEASSISTANT-017", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      // A 540-character line: 4× its length is far above 1500, so only the absolute cap can bite.
      const longLine = `Owned ${Array.from({ length: 60 }, (_, i) => `module${String(i).padStart(2, "0")}`).join(" ")}.`;
      const seed = await rewriteData.match({ userId: me.userId, cvText: `${CV_TEXT}\n- ${longLine}` });
      expect(longLine.length * 4).toBeGreaterThan(1501);

      const atLimit = await me.api.cvRewrite.accept(body(seed.matchId, [{ original: longLine, replacement: "y".repeat(1500) }]));
      expect(atLimit.status).toBe(201);

      const over = await me.api.cvRewrite.accept(body(seed.matchId, [{ original: longLine, replacement: "y".repeat(1501) }]));
      expect(over.status).toBe(400);
    }
  );

  test(
    "áp thay đổi làm CV rỗng bị từ chối",
    { tag: ["@TC-CVREWRITEASSISTANT-018", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId, cvText: API_BULLET });

      const res = await me.api.cvRewrite.accept(body(seed.matchId, [{ original: API_BULLET, replacement: "" }]));

      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("cvRewrite.errors.emptyResult"));
      expect(await rewriteData.childrenOf(seed.cvId)).toHaveLength(0);
    }
  );

  test(
    "tên CV mới được trim và giới hạn 1 đến 200 ký tự",
    { tag: ["@TC-CVREWRITEASSISTANT-019", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId });
      const change = [{ original: API_BULLET, replacement: API_REWORDED }];

      expect((await me.api.cvRewrite.accept(body(seed.matchId, change, "   "))).status).toBe(400);
      expect((await me.api.cvRewrite.accept(body(seed.matchId, change, "t".repeat(201)))).status).toBe(400);

      const atLimit = await me.api.cvRewrite.accept(body(seed.matchId, change, "t".repeat(200)));
      expect(atLimit.status).toBe(201);
      expect(atLimit.json().title).toBe("t".repeat(200));

      const padded = await me.api.cvRewrite.accept(body(seed.matchId, change, "  Padded title  "));
      expect(padded.status).toBe(201);
      expect(padded.json().title).toBe("Padded title");
      expect((await rewriteData.document(padded.json().id))?.title).toBe("Padded title");
    }
  );

  test(
    "số thay đổi phải từ 1 đến 25",
    { tag: ["@TC-CVREWRITEASSISTANT-020", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const cv = numberedCv(26);
      const seed = await rewriteData.match({ userId: me.userId, cvText: cv.text });
      const changes = cv.lines.map((line) => ({ original: line, replacement: line.replace("the billing team", "billing") }));

      expect((await me.api.cvRewrite.accept(body(seed.matchId, []))).status).toBe(400);
      expect((await me.api.cvRewrite.accept(body(seed.matchId, changes))).status).toBe(400);

      const atLimit = await me.api.cvRewrite.accept(body(seed.matchId, changes.slice(0, 25)));
      expect(atLimit.status).toBe(201);
      const text = atLimit.json().rawText;
      for (const { replacement } of changes.slice(0, 25)) expect(text).toContain(replacement);
      expect(text).toContain(cv.lines[25]);
    }
  );

  test(
    "body lưu sai kiểu hoặc quá dài bị từ chối",
    { tag: ["@TC-CVREWRITEASSISTANT-021", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId });
      const bodies: Array<Record<string, unknown>> = [
        body(seed.matchId, [{ original: "x".repeat(5001), replacement: "" }]),
        body("not-a-uuid", [{ original: API_BULLET, replacement: API_REWORDED }]),
        { matchResultId: seed.matchId, title: "No changes key" },
      ];
      for (const invalid of bodies) {
        const res = await me.api.cvRewrite.accept(invalid);
        expect(res.status, JSON.stringify(invalid).slice(0, 120)).toBe(400);
      }
      expect(await rewriteData.childrenOf(seed.cvId)).toHaveLength(0);
    }
  );

  test(
    "không lưu được bản viết lại từ match thất bại",
    { tag: ["@TC-CVREWRITEASSISTANT-022", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const failed = await rewriteData.match({ userId: me.userId, status: "failed" });

      const res = await me.api.cvRewrite.accept(body(failed.matchId, [{ original: API_BULLET, replacement: API_REWORDED }]));

      expect(res.status).toBe(400);
      expect(res.error().message).toBe(serverMessage("cvRewrite.errors.matchFailed"));
      expect(await rewriteData.childrenOf(failed.cvId)).toHaveLength(0);
    }
  );

  test(
    "lỗi grounding trả theo ngôn ngữ của request",
    { tag: ["@TC-CVREWRITEASSISTANT-023", "@creates-data"] },
    async ({ rewriteUsers, rewriteData }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId });
      const forged = body(seed.matchId, [{ original: FABRICATION, replacement: FABRICATION }]);
      const overlapping = body(seed.matchId, [
        { original: API_BULLET, replacement: "Built REST APIs." },
        { original: "REST APIs with Node.js and Express", replacement: "REST APIs with Node.js" },
      ]);

      const viHeader = await me.api.lang("vi").cvRewrite.accept(forged);
      expect(viHeader.status).toBe(400);
      expect(viHeader.error().message).toBe(serverMessage("cvRewrite.errors.changeNotGrounded", "vi"));

      const viQuery = await me.api.cvRewrite.accept(forged, { params: { lang: "vi" } });
      expect(viQuery.status).toBe(400);
      expect(viQuery.error().message).toBe(serverMessage("cvRewrite.errors.changeNotGrounded", "vi"));

      const overlapVi = await me.api.lang("vi").cvRewrite.accept(overlapping);
      expect(overlapVi.status).toBe(400);
      expect(overlapVi.error().message).toBe(serverMessage("cvRewrite.errors.changesOverlap", "vi"));
    }
  );

  test(
    "lỗi trả client không lộ chi tiết nội bộ",
    { tag: ["@TC-CVREWRITEASSISTANT-024", "@creates-data"] },
    async ({ rewriteUsers, rewriteData, anonApi }) => {
      const me = await rewriteUsers.signedIn();
      const seed = await rewriteData.match({ userId: me.userId });

      const responses = [
        await me.api.cvRewrite.accept(body(seed.matchId, [{ original: FABRICATION, replacement: FABRICATION }])),
        await me.api.cvRewrite.accept({}),
        await me.api.cvRewrite.accept(body(randomUUID(), [{ original: API_BULLET, replacement: API_REWORDED }])),
        await anonApi.cvRewrite.accept(body(seed.matchId, [{ original: API_BULLET, replacement: API_REWORDED }])),
      ];

      expect(responses.map((r) => r.status)).toEqual([400, 400, 404, 401]);
      for (const res of responses) {
        for (const marker of INTERNALS) expect(res.text, `${res.status} body`).not.toMatch(marker);
      }
    }
  );
});
