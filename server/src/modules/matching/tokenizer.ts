// Unicode-aware tokenizer for the keyword leg of the matching engine.
//
// Vietnamese is written one syllable at a time and NO word segmentation is
// performed: `hệ thống` becomes two tokens. Both CV and JD are written the
// same way, so overlap counting stays correct (project-goals.md ADR #14).
//
// Diacritics are FOLDED before comparison — Vietnamese CV/JD are frequently
// written without them and pdf-parse can mangle them depending on the font.
// See docs/specs/vietnamese-document-support/design.md §3.1.

const MIN_TOKEN_LENGTH = 2;

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
const ENGLISH_STOPWORDS = [
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "if",
  "then",
  "else",
  "of",
  "to",
  "in",
  "on",
  "at",
  "by",
  "for",
  "with",
  "about",
  "as",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "shall",
  "should",
  "can",
  "could",
  "may",
  "might",
  "must",
  "this",
  "that",
  "these",
  "those",
  "we",
  "you",
  "they",
  "it",
  "i",
  "he",
  "she",
  "their",
  "our",
  "your",
  "its",
  "from",
  "into",
  "over",
  "under",
  "not",
  "no",
  "so",
  "than",
  "too",
  "very",
  "up",
  "down",
  "out",
  "off"
];

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
//   `bi`  — Vietnamese "bị" (passive marker), but BI = Business Intelligence
//   `roi` — Vietnamese "rồi" (already), but ROI = Return on Investment
// Accepted limitation: `can` (Vietnamese "cần") collides with CAN bus, but it
// is already an English stopword, so excluding it here would change nothing.
// Rule of thumb: when a word is arguably a stopword AND arguably a technical
// keyword, LEAVE IT OUT. Missing a stopword only dilutes the score slightly;
// filtering a real keyword corrupts the result.
const VIETNAMESE_STOPWORDS = [
  "va",
  "voi",
  "cua",
  "cac",
  "duoc",
  "cho",
  "trong",
  "la",
  "co",
  "mot",
  "nhung",
  "de",
  "theo",
  "tai",
  "khi",
  "nay",
  "den",
  "tu",
  "ve",
  "vao",
  "cung",
  "minh",
  "chung",
  "toi",
  "ho",
  "se",
  "da",
  "dang",
  "chua",
  "khong",
  "chi",
  "con",
  "neu",
  "thi",
  "hoac",
  "hay",
  "nen",
  "phai",
  "can",
  "rat",
  "qua",
  "tren",
  "duoi",
  "giua",
  "sau",
  "truoc",
  "moi",
  "tat",
  "nhieu",
  "hon",
  "nhat",
  "vi",
  "boi",
  "nua"
];

// Combined lookup set used by tokenize() — bilingual by construction, not by
// later mutation.
const STOPWORDS = new Set([...ENGLISH_STOPWORDS, ...VIETNAMESE_STOPWORDS]);

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
    const canonical = ALIAS_MAP[token] ?? token;
    if (STOPWORDS.has(canonical)) continue;
    tokens.add(canonical);
  }
  return tokens;
}
