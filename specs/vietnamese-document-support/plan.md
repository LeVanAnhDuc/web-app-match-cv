# Vietnamese Document Support — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Làm chân keyword của matching engine chấm đúng tài liệu tiếng Việt, và tính lại điểm cho các `MatchResult` đã lưu bằng công thức mới.

**Architecture:** Tách một hàm thuần `tokenize()` sang file mới `tokenizer.ts`, chuẩn hoá Unicode + gỡ dấu + tra alias + lọc stopword trước khi đếm overlap. `MatchingService.keywordScore` chỉ đổi phần thân để gọi hàm đó; không đổi DTO, endpoint, schema DB hay FE. Một script bảo trì chạy tay tính lại điểm cũ bằng **chính** các hàm public của engine, không nhân bản logic.

**Tech Stack:** NestJS 11 · TypeScript 5 (`target: ES2023`, hỗ trợ Unicode property escapes) · Jest · Prisma 6 · ts-node (đã có, dùng bởi `prisma/seed.ts`) · yarn

## Global Constraints

- **BE-only.** Không đụng `client/`. Không đổi `prisma/schema.prisma`, không tạo migration.
- **Không thêm dependency mới.** Toàn bộ dùng `String.prototype.normalize` + Unicode property escapes có sẵn.
- **Không tách từ ghép tiếng Việt** — token ở cấp âm tiết (`project-goals.md` ADR #14).
- **Stopword tiếng Việt phải viết ở dạng ĐÃ GỠ DẤU** (`va`, `cua`, `duoc`), vì pipeline gỡ dấu trước khi lọc.
- **`ai` TUYỆT ĐỐI không được nằm trong stopword list** — `AI` là từ khoá kỹ thuật quan trọng bậc nhất của domain này (`design.md` §4.1). Cùng nguyên tắc, không thêm `ma` (mã = code) và `nam` (năm = year).
- **`MIN_TOKEN_LENGTH` giữ nguyên `2`.** Token 1 ký tự (`C`, `R`) vẫn bị bỏ — hạn chế có sẵn, ngoài phạm vi.
- **Không tính lại `semanticScore`** — cần gọi lại embedding, tốn tiền, và vế semantic vốn không hỏng.
- Convention BE: đọc `server/.claude/CLAUDE.md` + rule `constants`, `imports`, `services` trước khi sửa code.
- Chạy `npx prisma generate` **trước** `yarn lint --fix` — thiếu bước này rule typed của ESLint sẽ gỡ nhầm type assertion thật.
- Worktree: `server/.worktrees/vietnamese-document-support` + `docs/.worktrees/vietnamese-document-support`, branch `feat/vietnamese-document-support`.

## File Structure

| File | Trách nhiệm |
|---|---|
| `server/src/modules/matching/tokenizer.ts` **(mới)** | Hàm thuần `tokenize()` + `ALIAS_MAP` + `STOPWORDS`. Không DI, không import từ service. |
| `server/src/modules/matching/tokenizer.spec.ts` **(mới)** | Unit test cho `tokenize()`. |
| `server/src/modules/matching/matching.service.ts` **(sửa)** | Gỡ `STOPWORDS`/`tokenize` cũ; `keywordScore` gọi `tokenize()`; export `capForMatch` + `MAX_MATCH_CHARS` cho script dùng. |
| `server/src/modules/matching/matching.service.spec.ts` **(sửa)** | Thêm test bất biến cho cặp lệch dấu. |
| `server/scripts/recompute-keyword-scores.ts` **(mới)** | Script bảo trì chạy tay, dry-run mặc định. |
| `server/package.json` **(sửa)** | Thêm script `recompute-scores`. |
| `server/.claude/CLAUDE.md` **(sửa)** | Drift audit §4.6 — thêm `tokenizer.ts` + lệnh mới. |

**Quyết định phân rã**: `tokenize` tách khỏi service vì `matching.service.ts` đã ~240 dòng chứa cả engine lẫn CRUD; thêm ~57 stopword VI + ~30 alias nữa thì file làm quá nhiều việc. Ba hàm tính điểm (`keywordScore`/`cosine`/`combineOverall`) **ở lại service** — chúng là một bộ và đang được test cùng chỗ.

---

### Task 1: `tokenizer.ts` — Unicode-aware + gỡ dấu

**Files:**
- Create: `server/src/modules/matching/tokenizer.ts`
- Create: `server/src/modules/matching/tokenizer.spec.ts`

**Interfaces:**
- Consumes: (không có — task đầu tiên)
- Produces: `export function tokenize(text: string): Set<string>` · `export const MIN_TOKEN_LENGTH = 2`

Task này chỉ làm **chuẩn hoá + tách token**, chưa có stopword tiếng Việt (Task 2) và chưa có alias (Task 3). Stopword tiếng Anh chuyển nguyên xi từ `matching.service.ts` sang.

- [ ] **Step 1: Viết test thất bại**

Tạo `server/src/modules/matching/tokenizer.spec.ts`:

```ts
import { tokenize } from "./tokenizer";

describe("tokenize()", () => {
  it("[EP english] keeps meaningful English words and drops stopwords", () => {
    expect(tokenize("Experienced TypeScript developer")).toEqual(
      new Set(["experienced", "typescript", "developer"])
    );
  });

  it("[EP vietnamese] keeps Vietnamese syllables instead of shredding them", () => {
    expect(tokenize("Kinh nghiệm phát triển")).toEqual(
      new Set(["kinh", "nghiem", "phat", "trien"])
    );
  });

  it("[EP diacritics] folded text matches unfolded text token for token", () => {
    expect(tokenize("Kinh nghiệm phát triển hệ thống")).toEqual(
      tokenize("Kinh nghiem phat trien he thong")
    );
  });

  it("[BVA normalization] NFD input produces the same tokens as NFC input", () => {
    const nfc = "Kinh nghiệm phát triển";
    expect(tokenize(nfc.normalize("NFD"))).toEqual(
      tokenize(nfc.normalize("NFC"))
    );
  });

  it("[BVA length] drops tokens of length 1 and keeps tokens of length 2", () => {
    // `x` is deliberately NOT a stopword, so this isolates the length rule.
    const tokens = tokenize("x bc");
    expect(tokens.has("x")).toBe(false);
    expect(tokens.has("bc")).toBe(true);
  });

  it("[error guessing] folds the Vietnamese letter d-stroke to plain d", () => {
    expect(tokenize("đã dùng")).toEqual(tokenize("da dung"));
  });

  it("[error guessing] keeps +, # and . inside technical tokens", () => {
    const tokens = tokenize("C++ C# Node.js");
    expect(tokens.has("c++")).toBe(true);
    expect(tokens.has("c#")).toBe(true);
    expect(tokens.has("node.js")).toBe(true);
  });

  it("[error guessing] returns an empty set for empty or punctuation-only input", () => {
    expect(tokenize("")).toEqual(new Set());
    expect(tokenize("--- ,,, !!!")).toEqual(new Set());
  });
});
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `cd server && yarn test tokenizer`
Expected: FAIL — `Cannot find module './tokenizer'`

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `server/src/modules/matching/tokenizer.ts`:

```ts
// Unicode-aware tokenizer for the keyword leg of the matching engine.
//
// Vietnamese is written one syllable at a time and NO word segmentation is
// performed: `hệ thống` becomes two tokens. Both CV and JD are written the
// same way, so overlap counting stays correct (project-goals.md ADR #14).
//
// Diacritics are FOLDED before comparison — Vietnamese CV/JD are frequently
// written without them and pdf-parse can mangle them depending on the font.
// See docs/specs/vietnamese-document-support/design.md §3.1.

export const MIN_TOKEN_LENGTH = 2;

// Splits on anything that is not a letter, digit, `+`, `#` or `.`.
// `\p{L}` covers every alphabet rather than just a-z, which is the whole
// point: the previous `[^a-z0-9+#.]+` treated every Vietnamese diacritic as
// a separator. `+` / `#` / `.` are kept for `C++`, `C#`, `Node.js`.
const TOKEN_SEPARATOR = /[^\p{L}\p{N}+#.]+/u;
const COMBINING_MARKS = /\p{M}/gu;
const EDGE_DOTS = /^\.+|\.+$/g;
// `đ` is its own Unicode letter (U+0111), NOT `d` + a combining mark, so
// stripping marks does not touch it. Without this line `đã` and `da` would
// never match.
const D_STROKE = /đ/g;

// Small, deliberately conservative English stopword list — the goal is to
// strip near-universal filler words, not to build a full NLP pipeline.
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "of", "to",
  "in", "on", "at", "by", "for", "with", "about", "as", "is", "are", "was",
  "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "shall", "should", "can", "could", "may", "might", "must",
  "this", "that", "these", "those", "we", "you", "they", "it", "i", "he",
  "she", "their", "our", "your", "its", "from", "into", "over", "under",
  "not", "no", "so", "than", "too", "very", "up", "down", "out", "off"
]);

/**
 * Lowercases and strips diacritics. `normalize("NFD")` also unifies input
 * that arrived as NFC with input that arrived as NFD (pdf-parse emits NFD
 * depending on the font), so no separate NFC pass is needed.
 */
function foldDiacritics(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(D_STROKE, "d");
}

/** Splits text into a de-duplicated set of comparable keyword tokens. */
export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const rawToken of foldDiacritics(text).split(TOKEN_SEPARATOR)) {
    const token = rawToken.replace(EDGE_DOTS, "");
    if (token.length < MIN_TOKEN_LENGTH) continue;
    if (STOPWORDS.has(token)) continue;
    tokens.add(token);
  }
  return tokens;
}
```

- [ ] **Step 4: Chạy test để xác nhận nó pass**

Run: `cd server && yarn test tokenizer`
Expected: PASS — 8 test xanh

- [ ] **Step 5: Commit**

```bash
git add src/modules/matching/tokenizer.ts src/modules/matching/tokenizer.spec.ts
git commit -m "feat(matching): Unicode-aware tokenizer with diacritic folding"
```

---

### Task 2: Stopword tiếng Việt

**Files:**
- Modify: `server/src/modules/matching/tokenizer.ts` (mở rộng `STOPWORDS`)
- Modify: `server/src/modules/matching/tokenizer.spec.ts` (thêm test)

**Interfaces:**
- Consumes: `tokenize()` từ Task 1
- Produces: không có ký hiệu mới — chỉ mở rộng dữ liệu bên trong `tokenizer.ts`

- [ ] **Step 1: Viết test thất bại**

Thêm vào `describe("tokenize()")` trong `tokenizer.spec.ts`:

```ts
  it("[EP vietnamese stopwords] drops Vietnamese filler words", () => {
    const tokens = tokenize("phát triển hệ thống với các công nghệ của công ty");
    expect(tokens.has("voi")).toBe(false);
    expect(tokens.has("cac")).toBe(false);
    expect(tokens.has("cua")).toBe(false);
    expect(tokens.has("phat")).toBe(true);
    expect(tokens.has("trien")).toBe(true);
  });

  it("[decision table] never drops technical keywords that look like Vietnamese stopwords", () => {
    // `ai` is a Vietnamese interrogative pronoun AND the most important
    // technical keyword in this domain. `mã` (code) folds to `ma`, `năm`
    // (year) folds to `nam`. None of the three may be filtered.
    expect(tokenize("Kỹ sư AI").has("ai")).toBe(true);
    expect(tokenize("mã nguồn").has("ma")).toBe(true);
    expect(tokenize("3 năm kinh nghiệm").has("nam")).toBe(true);
  });
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `cd server && yarn test tokenizer`
Expected: FAIL — `expect(tokens.has("voi")).toBe(false)` nhận `true` (chưa có stopword VI)

- [ ] **Step 3: Viết implementation tối thiểu**

Trong `tokenizer.ts`, thêm ngay sau khối `STOPWORDS` tiếng Anh:

```ts
// Vietnamese stopwords — MUST be written WITHOUT diacritics, because
// foldDiacritics() runs before the lookup. Adding `và` instead of `va` is
// not an error, it simply never matches anything.
//
// Deliberately EXCLUDED, do not add them:
//   `ai`  — Vietnamese "who", but AI is this domain's top technical keyword
//   `ma`  — Vietnamese "mà" (filler), but `mã` (code) folds to the same form
//   `nam` — Vietnamese "năm" (year) is informative: "3 năm kinh nghiệm"
//   `it`  — already an English stopword; see design.md §4.1 for the known
//           collision with IT (information technology)
// Rule of thumb: when a word is arguably a stopword AND arguably a technical
// keyword, LEAVE IT OUT. Missing a stopword only dilutes the score slightly;
// filtering a real keyword corrupts the result.
const VIETNAMESE_STOPWORDS = [
  "va", "voi", "cua", "cac", "duoc", "cho", "trong", "la", "co", "mot",
  "nhung", "de", "theo", "tai", "khi", "nay", "den", "tu", "ve", "vao",
  "cung", "minh", "chung", "toi", "ho", "se", "da", "dang", "chua", "khong",
  "chi", "con", "neu", "thi", "hoac", "hay", "nen", "phai", "can", "rat",
  "qua", "bi", "tren", "duoi", "giua", "sau", "truoc", "moi", "tat",
  "nhieu", "hon", "nhat", "vi", "boi", "nua", "roi"
];

for (const word of VIETNAMESE_STOPWORDS) STOPWORDS.add(word);
```

- [ ] **Step 4: Chạy test để xác nhận nó pass**

Run: `cd server && yarn test tokenizer`
Expected: PASS — 10 test xanh

- [ ] **Step 5: Commit**

```bash
git add src/modules/matching/tokenizer.ts src/modules/matching/tokenizer.spec.ts
git commit -m "feat(matching): Vietnamese stopword list with technical-keyword guards"
```

---

### Task 3: `ALIAS_MAP` + thứ tự alias-trước-stopword

**Files:**
- Modify: `server/src/modules/matching/tokenizer.ts`
- Modify: `server/src/modules/matching/tokenizer.spec.ts`

**Interfaces:**
- Consumes: `tokenize()` từ Task 1–2
- Produces: không có ký hiệu mới

- [ ] **Step 1: Viết test thất bại**

Thêm vào `describe("tokenize()")`:

```ts
  it("[EP alias] normalises technical spelling variants to one canonical form", () => {
    expect(tokenize("ReactJS")).toEqual(tokenize("React"));
    expect(tokenize("React.js")).toEqual(tokenize("React"));
    expect(tokenize("k8s")).toEqual(tokenize("Kubernetes"));
    expect(tokenize("Postgres")).toEqual(tokenize("PostgreSQL"));
  });

  it("[decision table] applies aliases before the stopword filter", () => {
    // Ordering matters: if the stopword filter ran first, an alias key that
    // happens to be a stopword would be dropped before it could be mapped.
    expect(tokenize("js")).toEqual(new Set(["javascript"]));
  });
```

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `cd server && yarn test tokenizer`
Expected: FAIL — `tokenize("ReactJS")` cho `Set{"reactjs"}` chứ không phải `Set{"react"}`

- [ ] **Step 3: Viết implementation tối thiểu**

Thêm vào `tokenizer.ts`, sau khối stopword:

```ts
// Curated alias table — spelling variants that show up in real Vietnamese
// CVs and JDs. Keys are already folded/lowercased, so write them that way.
//
// Kept as a lookup table rather than suffix rules on purpose: a rule like
// "strip a trailing js" would collapse `angularjs` into `angular` (two
// different frameworks) and still could not handle `k8s` or `postgres`.
// See design.md §3.2. Missing an entry? Add one line.
const ALIAS_MAP: Record<string, string> = {
  reactjs: "react",
  "react.js": "react",
  nodejs: "node",
  "node.js": "node",
  vuejs: "vue",
  "vue.js": "vue",
  nextjs: "next",
  "next.js": "next",
  nestjs: "nest",
  "nest.js": "nest",
  expressjs: "express",
  "express.js": "express",
  js: "javascript",
  ts: "typescript",
  py: "python",
  "c#": "csharp",
  "c++": "cplusplus",
  golang: "go",
  postgres: "postgresql",
  psql: "postgresql",
  mongo: "mongodb",
  k8s: "kubernetes",
  gcp: "googlecloud",
  restful: "rest",
  html5: "html",
  css3: "css",
  ml: "machinelearning",
  db: "database"
};
```

> **Không có entry cho `CI/CD`** — `/` là ký tự phân tách nên chuỗi đó bị tách thành `ci` + `cd` **trước khi** tra bảng; một entry `"ci/cd"` sẽ không bao giờ khớp. Cùng lý do, đừng thêm bất kỳ key nào chứa ký tự nằm ngoài `[\p{L}\p{N}+#.]`.

Rồi sửa vòng lặp trong `tokenize()` — chèn bước tra alias **trước** bước lọc stopword:

```ts
export function tokenize(text: string): Set<string> {
  const tokens = new Set<string>();
  for (const rawToken of foldDiacritics(text).split(TOKEN_SEPARATOR)) {
    const token = rawToken.replace(EDGE_DOTS, "");
    if (token.length < MIN_TOKEN_LENGTH) continue;
    const canonical = ALIAS_MAP[token] ?? token;
    if (STOPWORDS.has(canonical)) continue;
    tokens.add(canonical);
  }
  return tokens;
}
```

- [ ] **Step 4: Chạy test để xác nhận nó pass**

Run: `cd server && yarn test tokenizer`
Expected: PASS — 12 test xanh

- [ ] **Step 5: Commit**

```bash
git add src/modules/matching/tokenizer.ts src/modules/matching/tokenizer.spec.ts
git commit -m "feat(matching): technical alias table applied before stopword filter"
```

---

### Task 4: Nối `tokenizer` vào `MatchingService`

**Files:**
- Modify: `server/src/modules/matching/matching.service.ts` — xoá `STOPWORDS` (dòng 31–104), xoá `MIN_TOKEN_LENGTH` (dòng 24), xoá phương thức `tokenize` (dòng 124–133); sửa `keywordScore` (dòng 136–145); export `capForMatch` (dòng 29)
- Modify: `server/src/modules/matching/matching.service.spec.ts`

**Interfaces:**
- Consumes: `tokenize()` từ Task 1–3
- Produces: `export const capForMatch: (text: string) => string` — Task 5 dùng. `MatchingService.keywordScore(cvText, jdText): number` giữ nguyên chữ ký.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `describe("keywordScore()")` trong `matching.service.spec.ts`:

```ts
    it("[EP vietnamese] scores a Vietnamese CV against a Vietnamese JD", () => {
      const service = makeService();
      const score = service.keywordScore(
        "Kinh nghiệm phát triển hệ thống với ReactJS và Node.js",
        "Cần kinh nghiệm phát triển hệ thống React Node"
      );
      expect(score).toBeGreaterThanOrEqual(60);
    });

    it("[invariant] a JD written without diacritics scores the same as one with", () => {
      const service = makeService();
      const cv = "Kinh nghiệm phát triển hệ thống với ReactJS và Node.js";
      expect(
        service.keywordScore(cv, "Cần kinh nghiem phat trien he thong React Node")
      ).toBe(
        service.keywordScore(cv, "Cần kinh nghiệm phát triển hệ thống React Node")
      );
    });
```

Assert **quan hệ** thay vì một con số cụ thể: con số sẽ đổi mỗi lần ai đó thêm một dòng vào stopword list, và test giòn sẽ bị vô hiệu hoá thay vì được sửa.

- [ ] **Step 2: Chạy test để xác nhận nó fail**

Run: `cd server && yarn test matching.service`
Expected: FAIL — `[EP vietnamese]` nhận điểm thấp (~13), `[invariant]` nhận 2 số khác nhau

- [ ] **Step 3: Viết implementation tối thiểu**

Trong `matching.service.ts`:

1. Xoá hằng `MIN_TOKEN_LENGTH` và toàn bộ khối `STOPWORDS` (chúng đã chuyển sang `tokenizer.ts`).
2. Export `capForMatch` để Task 5 dùng lại đúng ngưỡng cắt của engine (`MAX_MATCH_CHARS` giữ nguyên private — không ai ngoài file này cần con số thô):

```ts
const MAX_MATCH_CHARS = 20_000;
export const capForMatch = (text: string): string =>
  text.slice(0, MAX_MATCH_CHARS);
```

3. Thêm import:

```ts
import { tokenize } from "./tokenizer";
```

4. Xoá phương thức `private tokenize(...)` và sửa `keywordScore`:

```ts
  /** |JD ∩ CV| / |JD| * 100, rounded, clamped to [0, 100]. 0 if JD has no meaningful tokens. */
  keywordScore(cvText: string, jdText: string): number {
    const jdTokens = tokenize(jdText);
    if (jdTokens.size === 0) return 0;
    const cvTokens = tokenize(cvText);
    let overlap = 0;
    for (const token of jdTokens) {
      if (cvTokens.has(token)) overlap += 1;
    }
    return clampPercent(Math.round((overlap / jdTokens.size) * 100));
  }
```

- [ ] **Step 4: Chạy toàn bộ test của module**

Run: `cd server && yarn test matching`
Expected: PASS — 4 test `keywordScore` **cũ vẫn xanh** (đã kiểm chứng khi lập plan: full=100, partial=33, none=0, boundary=0) + 2 test mới xanh + 12 test tokenizer xanh

- [ ] **Step 5: Commit**

```bash
git add src/modules/matching/matching.service.ts src/modules/matching/matching.service.spec.ts
git commit -m "refactor(matching): keywordScore uses the shared Unicode tokenizer"
```

---

### Task 5: Script tính lại điểm cũ

**Files:**
- Create: `server/scripts/recompute-keyword-scores.ts`
- Modify: `server/package.json` (thêm script `recompute-scores`)

**Interfaces:**
- Consumes: `MAX_MATCH_CHARS`, `capForMatch` từ Task 4 · `MatchingService.keywordScore` và `MatchingService.combineOverall`
- Produces: lệnh CLI `yarn recompute-scores [--apply]`

Script **tái dùng chính các phương thức public của engine** thay vì chép lại công thức — đó là điều duy nhất đảm bảo điểm tính lại khớp với điểm một lần match thật sẽ tạo ra. Nó dựng `MatchingService` với collaborator `undefined` y như `matching.service.spec.ts` làm, vì `keywordScore`/`combineOverall` là hàm thuần không đụng tới DI.

- [ ] **Step 1: Viết script**

Tạo `server/scripts/recompute-keyword-scores.ts`:

```ts
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
  undefined as never
);

async function main() {
  const results = await prisma.matchResult.findMany({
    include: { cvDocument: true, jdDocument: true },
    orderBy: { createdAt: "asc" }
  });

  let changed = 0;

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
      await prisma.matchResult.update({
        where: { id: row.id },
        data: { keywordScore, overallScore }
      });
    }
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
```

- [ ] **Step 2: Đăng ký lệnh yarn**

Trong `server/package.json`, thêm vào khối `"scripts"` (ngay sau dòng `"test:e2e"`):

```json
    "recompute-scores": "ts-node --compiler-options {\"module\":\"CommonJS\"} scripts/recompute-keyword-scores.ts",
```

Dùng đúng cách gọi `ts-node` mà `prisma.seed` đang dùng — không thêm dependency nào.

- [ ] **Step 3: Chạy dry-run trên DB thật**

Run: `cd server && yarn recompute-scores`
Expected: in danh sách `id  keyword X -> Y   overall A -> B`, kết thúc bằng `Dry run — pass --apply to write the changes.` **Không có row nào bị ghi.**

Xác nhận bằng cách chạy lại đúng lệnh trên: output phải **y hệt** (dry-run không đổi trạng thái).

- [ ] **Step 4: Áp thật rồi kiểm chứng tính idempotent**

Run: `cd server && yarn recompute-scores --apply`
Expected: cùng danh sách, kết thúc bằng `Applied.`

Run lại: `cd server && yarn recompute-scores`
Expected: `0 would change.` — chạy lần hai không còn gì để đổi. Đây là bằng chứng script idempotent.

- [ ] **Step 5: Commit**

```bash
git add scripts/recompute-keyword-scores.ts package.json
git commit -m "chore(matching): add one-off keyword score recompute script"
```

---

### Task 6: Drift audit + green checks

**Files:**
- Modify: `server/.claude/CLAUDE.md`

**Interfaces:**
- Consumes: mọi thứ từ Task 1–5
- Produces: (không có ký hiệu code)

- [ ] **Step 1: Cập nhật convention doc**

Trong `server/.claude/CLAUDE.md`, khối ` ```bash ` ở mục **Commands**, thêm dòng dưới `yarn seed`:

```bash
yarn recompute-scores                  # dry-run: tính lại keywordScore/overallScore cho MatchResult cũ
yarn recompute-scores --apply          # ghi thật
```

Trong mục **Core Patterns**, thêm một gạch đầu dòng:

```markdown
- **Tokenizer**: chân keyword của matching engine dùng `src/modules/matching/tokenizer.ts` (hàm thuần `tokenize()`, Unicode-aware, gỡ dấu tiếng Việt, alias kỹ thuật). KHÔNG tự viết logic tách token ở nơi khác — sửa bảng từ trong file đó.
```

- [ ] **Step 2: Chạy đủ green checks**

Run lần lượt, mỗi lệnh phải xanh mới sang lệnh sau:

```bash
cd server
npx prisma generate
yarn format
yarn lint
yarn type-check
yarn test
yarn build
```

Expected: cả 6 lệnh thoát mã 0. `yarn format`/`yarn lint` có thể tự sửa file — đọc lại file sau khi chạy.

- [ ] **Step 3: Commit**

```bash
git add .claude/CLAUDE.md
git commit -m "docs(server): document the matching tokenizer and recompute-scores command"
```

---

## Sau khi hoàn tất plan

Theo `.claude/CLAUDE.md` §5, còn 3 cổng trước khi mở PR:

1. **§4.5 Security review** — **CHẠY**. Feature xử lý text do user nạp. Điểm cần soi: regex `\p{L}` có nguy cơ catastrophic backtracking không (đánh giá ban đầu: **không** — character class thuần, không lồng quantifier), và input đã bị chặn ở `MAX_MATCH_CHARS = 20_000` trước khi tới `keywordScore`. Lưu kết quả vào `docs/specs/vietnamese-document-support/security-report.md`.
2. **§4.3 E2E** — **SKIP**, ghi lý do: không có UI mới, không flow mới; đã verify `client/e2e/cv-jd-matching-wizard/helpers.ts` dùng `MatchResult` stub cắm thẳng vào DB (82/90/74) nên không chạm engine.
3. **§5 step 5 PR** — 2 repo: `docs/` (design + plan + security-report) và `server/` (code). Cùng branch `feat/vietnamese-document-support`.

## Tiêu chí nghiệm thu (từ `design.md` §8)

- [ ] Ví dụ §1.2 của design cho `keywordScore` ≥ 60% (hiện 12%)
- [ ] Cặp CV↔JD tiếng Anh thuần cho **đúng điểm như trước khi sửa** — 4 test cũ vẫn xanh
- [ ] Cặp *CV có dấu ↔ JD không dấu* cho cùng điểm với cặp *cả hai đều có dấu*
- [ ] Input NFC và NFD của cùng văn bản cho cùng token set
- [ ] `yarn recompute-scores --apply` chạy xong; chạy lại lần hai báo `0 would change.`
