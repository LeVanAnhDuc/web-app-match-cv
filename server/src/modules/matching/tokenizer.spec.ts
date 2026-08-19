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
    // Asserts the canonical forms: `c++` and `c#` only survive the split if
    // TOKEN_SEPARATOR treats `+` and `#` as word characters — had they been
    // separators, the alias lookup could never have fired at all.
    const tokens = tokenize("C++ C# Node.js");
    expect(tokens.has("cplusplus")).toBe(true);
    expect(tokens.has("csharp")).toBe(true);
    expect(tokens.has("node")).toBe(true);
  });

  it("[error guessing] returns an empty set for empty or punctuation-only input", () => {
    expect(tokenize("")).toEqual(new Set());
    expect(tokenize("--- ,,, !!!")).toEqual(new Set());
  });

  it("[EP vietnamese stopwords] drops Vietnamese filler words", () => {
    const tokens = tokenize(
      "phát triển hệ thống với các công nghệ của công ty"
    );
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

  it("[decision table] keeps business abbreviations that look like Vietnamese stopwords", () => {
    // `bị` folds to `bi` (BI = Business Intelligence) and `rồi` folds to `roi`
    // (ROI = Return on Investment). Neither may be filtered.
    expect(tokenize("Power BI developer").has("bi")).toBe(true);
    expect(tokenize("improved ROI by 20%").has("roi")).toBe(true);
  });

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
});
