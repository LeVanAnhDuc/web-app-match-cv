# AI Credentials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user store their own AI provider API keys (encrypted at rest), test that each key really works for both chat and embeddings, and run a CV↔JD match with a chosen credential — falling back to the system key when they have none.

**Architecture:** Providers are a **const descriptor table**, not classes — all three (OpenRouter, OpenAI, Gemini) speak the OpenAI-compatible protocol, so they differ only in `baseUrl` and default model names. `AiService` stops holding a client and instead takes an `AiRuntimeConfig` per call. A new `AiCredentialsService` owns encryption (AES-256-GCM via `node:crypto`) and is the only place a plaintext key is ever materialised.

**Tech Stack:** NestJS 11, Prisma/PostgreSQL, `openai` SDK, class-validator, nestjs-i18n, Jest (BE) · TanStack Start (React 19), Ant Design 5, Tailwind 4, TanStack Query, Zustand, i18next, Vitest + Playwright (FE). **No new dependency is added.**

**Spec:** `docs/specs/ai-credentials/design.md`

## Global Constraints

- **Worktrees**: work happens in `server/.worktrees/ai-credentials`, `client/.worktrees/ai-credentials`, `docs/.worktrees/ai-credentials`, all on branch `feat/ai-credentials`. Never commit to `main`.
- **Secrets never leave the service layer.** `encryptedKey` / `keyIv` / `keyTag` must not appear in any DTO, log line, Swagger example, or error message. Exactly one method — `AiCredentialsService.getRuntimeConfig()` — decrypts.
- **Never log a provider's error body.** `catch { throw ... }` — no `console.*`, no logger call carrying the caught error.
- **Provider whitelist** is exactly `openrouter | openai | gemini` (project-goals ADR #10).
- **Input limits** (used verbatim in DTOs and tests): `apiKey` 20–400 chars, no whitespace; `label` 1–60 chars, trimmed; `chatModel`/`embedModel` 1–120 chars, no whitespace, blank → `null`.
- **Encryption key**: env `CREDENTIAL_ENCRYPTION_KEY`, base64 that decodes to **exactly 32 bytes**. Optional at boot; missing/malformed → every credential endpoint returns **503**. Never auto-generate one.
- **Default models** (single source of truth is `PROVIDERS` in `server/src/modules/ai/providers.ts`):
  - `openrouter` → `https://openrouter.ai/api/v1` · `openai/gpt-4o-mini` · `openai/text-embedding-3-small`
  - `openai` → `https://api.openai.com/v1` · `gpt-4o-mini` · `text-embedding-3-small`
  - `gemini` → `https://generativelanguage.googleapis.com/v1beta/openai/` · `gemini-2.5-flash` · `gemini-embedding-001`
- **BE quality gate** after every task touching `server/`: `yarn format && yarn lint && yarn type-check && yarn test && yarn build` — all green.
- **FE quality gate** after every task touching `client/`: `yarn format && yarn lint && yarn type-check && yarn test && yarn build` — all green.
- **Conventions**: BE follows `server/.claude/CLAUDE.md` + rules; FE follows `client/.claude/CLAUDE.md` + rules (one component per folder as `index.tsx`, arrow fn, single default export, props inline, antd for interactive elements, `#/` alias, all copy via `t()` with `en` + `vi` in sync).
- **Endpoint base**: `api/v1`. The existing match controller is mounted at `match` (singular) — not `matches`.

## File Structure

**server/**
| File | Responsibility |
|---|---|
| `src/common/crypto/credential-crypto.service.ts` | AES-256-GCM encrypt/decrypt + `isConfigured()`. Knows nothing about credentials. |
| `src/common/crypto/crypto.module.ts` | Exports the crypto service. |
| `src/modules/ai/providers.ts` | `PROVIDERS` table, `AiProvider` re-export, `AiRuntimeConfig`, `resolveModels()`. |
| `src/modules/ai/ai.service.ts` | Moved from `matching/`. Per-call client; `embed`, `generateReport`, `ping`, `systemRuntimeConfig`. |
| `src/modules/ai/ai.module.ts` | Exports `AiService`. |
| `src/modules/ai/i18n-messages.ts` | `tAi()` for the `ai.*` namespace. |
| `src/modules/ai-credentials/*` | Controller + service + DTOs + i18n for credential CRUD and testing. |
| `src/modules/matching/matching.service.ts` | Gains credential resolution + snapshot columns. |
| `prisma/schema.prisma` + `prisma/migrations/*` | `AiCredential`, two enums, four new `MatchResult` columns. |

**client/**
| File | Responsibility |
|---|---|
| `src/types/AiCredentials/index.ts` | DTO mirrors + input types. |
| `src/requests/aiCredentials.ts` | Pure `apiFetch` calls + query-key factory. |
| `src/hooks/useAiCredentials.ts` | React Query hooks. |
| `src/components/TestStatusTag/index.tsx` | Status chip, shared by page and wizard. |
| `src/components/CredentialFormModal/index.tsx` | Add/edit form dialog, shared by page and wizard. |
| `src/views/AiCredentials/**` | The `/ai-credentials` page. |
| `src/views/Wizard/components/RunWithSelector/index.tsx` | Step 3 "Run with" block. |

---

### Task 1: Credential encryption service

**Files:**
- Create: `server/src/common/crypto/credential-crypto.service.ts`
- Create: `server/src/common/crypto/crypto.module.ts`
- Create: `server/src/common/crypto/credential-crypto.service.spec.ts`
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/.env.example`

**Interfaces:**
- Consumes: nothing.
- Produces: `EncryptedPayload { ciphertext: Buffer; iv: Buffer; tag: Buffer }`; `CredentialCryptoService.isConfigured(): boolean`, `.encrypt(plain: string): EncryptedPayload`, `.decrypt(payload: EncryptedPayload): string`; `CryptoModule`.

- [ ] **Step 1: Write the failing test**

Create `server/src/common/crypto/credential-crypto.service.spec.ts`:

```ts
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { CredentialCryptoService } from "./credential-crypto.service";

const KEY_B64 = randomBytes(32).toString("base64");

function makeService(key?: string): CredentialCryptoService {
  const config = {
    get: (name: string) => (name === "CREDENTIAL_ENCRYPTION_KEY" ? key : undefined)
  } as unknown as ConfigService;
  return new CredentialCryptoService(config);
}

describe("CredentialCryptoService", () => {
  it("reports configured only for a base64 key of exactly 32 bytes", () => {
    expect(makeService(KEY_B64).isConfigured()).toBe(true);
    expect(makeService(undefined).isConfigured()).toBe(false);
    expect(makeService(randomBytes(16).toString("base64")).isConfigured()).toBe(false);
    expect(makeService("not-base64-!!!").isConfigured()).toBe(false);
  });

  it("round-trips a value", () => {
    const service = makeService(KEY_B64);
    const payload = service.encrypt("sk-super-secret-value-1234");
    expect(service.decrypt(payload)).toBe("sk-super-secret-value-1234");
  });

  it("never reuses an IV and never stores plaintext in the ciphertext", () => {
    const service = makeService(KEY_B64);
    const a = service.encrypt("sk-super-secret-value-1234");
    const b = service.encrypt("sk-super-secret-value-1234");
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
    expect(a.ciphertext.toString("utf8")).not.toContain("sk-super-secret");
  });

  it("throws when the ciphertext is tampered with", () => {
    const service = makeService(KEY_B64);
    const payload = service.encrypt("sk-super-secret-value-1234");
    payload.ciphertext[0] ^= 0xff;
    expect(() => service.decrypt(payload)).toThrow();
  });

  it("throws when the auth tag is tampered with", () => {
    const service = makeService(KEY_B64);
    const payload = service.encrypt("sk-super-secret-value-1234");
    payload.tag[0] ^= 0xff;
    expect(() => service.decrypt(payload)).toThrow();
  });

  it("throws on encrypt/decrypt when not configured", () => {
    const service = makeService(undefined);
    expect(() => service.encrypt("x")).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server/.worktrees/ai-credentials && yarn test credential-crypto`
Expected: FAIL — `Cannot find module './credential-crypto.service'`.

- [ ] **Step 3: Write the implementation**

Create `server/src/common/crypto/credential-crypto.service.ts`:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { I18nContext } from "nestjs-i18n";

const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12; // GCM standard nonce length

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

/**
 * AES-256-GCM for user-supplied provider API keys.
 *
 * Optional at boot (mirrors AiService): the app starts without
 * CREDENTIAL_ENCRYPTION_KEY so tests and unrelated endpoints keep working;
 * the key becomes required the moment a credential is read or written.
 * A temporary key is NEVER generated — ciphertext written under a throwaway
 * key would be undecryptable after the next restart.
 */
@Injectable()
export class CredentialCryptoService {
  private readonly key?: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>("CREDENTIAL_ENCRYPTION_KEY");
    const decoded = raw ? Buffer.from(raw, "base64") : undefined;
    this.key = decoded?.length === KEY_BYTES ? decoded : undefined;
  }

  isConfigured(): boolean {
    return this.key !== undefined;
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new ServiceUnavailableException(
        I18nContext.current()?.t("aiCredentials.errors.cryptoNotConfigured" as never) ??
          "Credential storage is not configured. Please contact the administrator."
      );
    }
    return this.key;
  }

  encrypt(plain: string): EncryptedPayload {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.requireKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    return { ciphertext, iv, tag: cipher.getAuthTag() };
  }

  decrypt({ ciphertext, iv, tag }: EncryptedPayload): string {
    const decipher = createDecipheriv(ALGORITHM, this.requireKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  }
}
```

Create `server/src/common/crypto/crypto.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { CredentialCryptoService } from "./credential-crypto.service";

@Module({
  providers: [CredentialCryptoService],
  exports: [CredentialCryptoService]
})
export class CryptoModule {}
```

- [ ] **Step 4: Add the env var**

In `server/src/config/env.validation.ts`, add inside `class EnvVars` after the OpenRouter block:

```ts
  // --- Credential encryption (Goal 6) — base64 of exactly 32 bytes.
  // Optional at boot, required when any /ai-credentials endpoint is called.
  @IsOptional() @IsString() CREDENTIAL_ENCRYPTION_KEY?: string;
```

Append to `server/.env.example`:

```
# --- Credential encryption (BYO AI credentials) — base64 of exactly 32 bytes.
# Generate with: openssl rand -base64 32
# Optional at boot; required when calling /ai-credentials. NEVER commit a real value.
# CREDENTIAL_ENCRYPTION_KEY=
```

- [ ] **Step 5: Run test to verify it passes**

Run: `yarn test credential-crypto`
Expected: PASS, 6 tests.

- [ ] **Step 6: Quality gate + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test && yarn build
git add src/common/crypto src/config/env.validation.ts .env.example
git commit -m "feat(crypto): AES-256-GCM service for user API keys"
```

---

### Task 2: Prisma schema + migration

**Files:**
- Modify: `server/prisma/schema.prisma`
- Create: `server/prisma/migrations/<timestamp>_add_ai_credential/migration.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: Prisma types `AiCredential`, enums `AiProvider` (`openrouter | openai | gemini`) and `AiTestStatus` (`ok | invalid_key | no_quota | model_unavailable | unreachable`); `MatchResult` gains `credentialId: string | null`, `provider: AiProvider`, `chatModel: string`, `embedModel: string`.

- [ ] **Step 1: Edit the schema**

In `server/prisma/schema.prisma`, add after the `SourceFormat` enum:

```prisma
enum AiProvider {
  openrouter
  openai
  gemini
}

enum AiTestStatus {
  ok
  invalid_key
  no_quota
  model_unavailable
  unreachable
}
```

Add `aiCredentials AiCredential[]` to the `User` model's relation list.

Add the new model at the end of the file:

```prisma
model AiCredential {
  id             String        @id @default(uuid())
  userId         String
  user           User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider       AiProvider
  label          String
  encryptedKey   Bytes
  keyIv          Bytes
  keyTag         Bytes
  keyLast4       String
  chatModel      String?
  embedModel     String?
  lastTestStatus AiTestStatus?
  lastTestedAt   DateTime?
  lastUsedAt     DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  matchResults MatchResult[]

  @@unique([userId, label])
  @@index([userId])
}
```

In `model MatchResult`, add after `keywordScore`:

```prisma
  credentialId  String?
  credential    AiCredential? @relation(fields: [credentialId], references: [id], onDelete: SetNull)
  provider      AiProvider
  chatModel     String
  embedModel    String
```

- [ ] **Step 2: Generate the migration without applying it**

Run: `npx prisma migrate dev --name add_ai_credential --create-only`

- [ ] **Step 3: Rewrite the generated SQL so existing rows survive**

The generated file adds three NOT NULL columns to a table that already has rows, which fails. Replace the `MatchResult` portion of `migration.sql` with backfill-then-drop-default (keep the generated `CREATE TYPE` / `CREATE TABLE` / index / FK statements for `AiCredential` as produced):

```sql
-- MatchResult: add snapshot columns. Every pre-existing match ran through
-- OpenRouter with the env defaults, so backfill with those, then drop the
-- defaults so future writes must state the provider explicitly.
ALTER TABLE "MatchResult" ADD COLUMN "credentialId" TEXT;
ALTER TABLE "MatchResult" ADD COLUMN "provider" "AiProvider" NOT NULL DEFAULT 'openrouter';
ALTER TABLE "MatchResult" ADD COLUMN "chatModel" TEXT NOT NULL DEFAULT 'openai/gpt-4o-mini';
ALTER TABLE "MatchResult" ADD COLUMN "embedModel" TEXT NOT NULL DEFAULT 'openai/text-embedding-3-small';

ALTER TABLE "MatchResult" ALTER COLUMN "provider" DROP DEFAULT;
ALTER TABLE "MatchResult" ALTER COLUMN "chatModel" DROP DEFAULT;
ALTER TABLE "MatchResult" ALTER COLUMN "embedModel" DROP DEFAULT;

ALTER TABLE "MatchResult" ADD CONSTRAINT "MatchResult_credentialId_fkey"
  FOREIGN KEY ("credentialId") REFERENCES "AiCredential"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Step 4: Apply and verify**

Run: `npx prisma migrate dev && npx prisma generate`
Then verify old rows survived:

Run: `npx prisma db execute --stdin <<< 'SELECT provider, "chatModel" FROM "MatchResult" LIMIT 5;'`
Expected: existing rows show `openrouter` / `openai/gpt-4o-mini`; no error.

- [ ] **Step 5: Quality gate + commit**

`seed.ts` needs no change — no credential is seeded, because there is no real key to seed.

```bash
yarn format && yarn lint && yarn type-check && yarn test && yarn build
git add prisma
git commit -m "feat(prisma): AiCredential model and MatchResult provider snapshot"
```

---

### Task 3: Extract `modules/ai` with per-request configuration

**Files:**
- Create: `server/src/modules/ai/providers.ts`
- Create: `server/src/modules/ai/ai.module.ts`
- Create: `server/src/modules/ai/i18n-messages.ts`
- Create: `server/src/i18n/en/ai.json`, `server/src/i18n/vi/ai.json`
- Move: `server/src/modules/matching/ai.service.ts` → `server/src/modules/ai/ai.service.ts`
- Move: `server/src/modules/matching/ai.service.spec.ts` → `server/src/modules/ai/ai.service.spec.ts`
- Modify: `server/src/modules/matching/matching.module.ts`, `matching.service.ts`
- Modify: `server/src/i18n/en/matching.json`, `server/src/i18n/vi/matching.json`

**Interfaces:**
- Consumes: Task 2's `AiProvider` enum.
- Produces:
  - `PROVIDERS: Record<AiProvider, { baseUrl: string; defaultChatModel: string; defaultEmbedModel: string }>`
  - `AiRuntimeConfig { provider: AiProvider; apiKey: string; baseUrl: string; chatModel: string; embedModel: string }`
  - `resolveModels(provider, chatModel: string | null, embedModel: string | null): { baseUrl: string; chatModel: string; embedModel: string }`
  - `AiService.embed(text: string, cfg: AiRuntimeConfig): Promise<number[]>`
  - `AiService.generateReport(cvText: string, jdText: string, scores: MatchScores, cfg: AiRuntimeConfig): Promise<MatchReport>`
  - `AiService.ping(cfg: AiRuntimeConfig): Promise<{ chat: AiTestStatus; embed: AiTestStatus }>`
  - `AiService.systemRuntimeConfig(): AiRuntimeConfig`
  - `AiModule` exporting `AiService`

- [ ] **Step 1: Write the provider table**

Create `server/src/modules/ai/providers.ts`:

```ts
import { AiProvider } from "@prisma/client";

export interface ProviderDescriptor {
  baseUrl: string;
  defaultChatModel: string;
  defaultEmbedModel: string;
}

/**
 * The whole difference between supported providers is data, not behaviour:
 * all three speak the OpenAI-compatible protocol (project-goals ADR #10), so
 * one `openai` client with a different baseURL drives all of them. Gemini's
 * compatibility layer covers /chat/completions AND /embeddings, which is why
 * it qualifies — see design.md section 2.
 */
export const PROVIDERS: Record<AiProvider, ProviderDescriptor> = {
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    defaultChatModel: "openai/gpt-4o-mini",
    defaultEmbedModel: "openai/text-embedding-3-small"
  },
  openai: {
    baseUrl: "https://api.openai.com/v1",
    defaultChatModel: "gpt-4o-mini",
    defaultEmbedModel: "text-embedding-3-small"
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultChatModel: "gemini-2.5-flash",
    defaultEmbedModel: "gemini-embedding-001"
  }
};

/** Plaintext key inside — internal only. Never a DTO, never serialised, never logged. */
export interface AiRuntimeConfig {
  provider: AiProvider;
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  embedModel: string;
}

/** Per-credential overrides win over the provider default; blank counts as no override. */
export function resolveModels(
  provider: AiProvider,
  chatModel: string | null,
  embedModel: string | null
): { baseUrl: string; chatModel: string; embedModel: string } {
  const descriptor = PROVIDERS[provider];
  return {
    baseUrl: descriptor.baseUrl,
    chatModel: chatModel?.trim() || descriptor.defaultChatModel,
    embedModel: embedModel?.trim() || descriptor.defaultEmbedModel
  };
}
```

- [ ] **Step 2: Write the failing test for `resolveModels` and `ping` mapping**

Create `server/src/modules/ai/providers.spec.ts`:

```ts
import { PROVIDERS, resolveModels } from "./providers";

describe("resolveModels", () => {
  it("falls back to the provider default when no override is given", () => {
    expect(resolveModels("openrouter", null, null)).toEqual({
      baseUrl: PROVIDERS.openrouter.baseUrl,
      chatModel: "openai/gpt-4o-mini",
      embedModel: "openai/text-embedding-3-small"
    });
  });

  it("prefers the override", () => {
    const result = resolveModels("openai", "gpt-4o", "text-embedding-3-large");
    expect(result.chatModel).toBe("gpt-4o");
    expect(result.embedModel).toBe("text-embedding-3-large");
  });

  it("treats a blank override as absent", () => {
    expect(resolveModels("gemini", "   ", "").chatModel).toBe("gemini-2.5-flash");
    expect(resolveModels("gemini", "   ", "").embedModel).toBe("gemini-embedding-001");
  });
});
```

Run: `yarn test providers` → PASS (implementation already written in Step 1).

- [ ] **Step 3: Move and rewrite `AiService`**

Move the file with `git mv src/modules/matching/ai.service.ts src/modules/ai/ai.service.ts` and `git mv src/modules/matching/ai.service.spec.ts src/modules/ai/ai.service.spec.ts`, then rewrite `ai.service.ts` so no client is held on the instance:

```ts
import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AiProvider, AiTestStatus } from "@prisma/client";
import OpenAI from "openai";
import { AiRuntimeConfig, PROVIDERS, resolveModels } from "./providers";
import { tAi } from "./i18n-messages";

export interface MatchScores {
  overallScore: number;
  semanticScore: number;
  keywordScore: number;
}

export interface MatchReport {
  strengths: string[];
  gaps: string[];
  suggestions: string[];
}

const AI_TIMEOUT_MS = 20_000; // availability guard: /match must fail 503, not hang
const PING_INPUT = "ping";
const PING_MAX_TOKENS = 5;

// Worst-first. The aggregate test status is the first of these that either
// capability reported, so "chat ok + embed invalid_key" surfaces as invalid_key.
const SEVERITY_ORDER: AiTestStatus[] = [
  AiTestStatus.invalid_key,
  AiTestStatus.no_quota,
  AiTestStatus.model_unavailable,
  AiTestStatus.unreachable,
  AiTestStatus.ok
];

function notConfiguredError(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    tAi("ai.errors.notConfigured", "Matching service is not configured. Please contact the administrator.")
  );
}

function aiFailedError(): ServiceUnavailableException {
  return new ServiceUnavailableException(
    tAi("ai.errors.aiFailed", "Matching service failed. Please try again later.")
  );
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

async function withTimeout<T>(work: Promise<T>): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(aiFailedError()), AI_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

/**
 * Classify a provider failure WITHOUT retaining its message: provider error
 * bodies can echo the submitted key, so the message is inspected in-memory
 * and discarded — never stored, returned, or logged.
 */
export function mapProviderError(error: unknown): AiTestStatus {
  const status = error instanceof OpenAI.APIError ? error.status : undefined;
  if (status === 401 || status === 403) return AiTestStatus.invalid_key;
  if (status === 402 || status === 429) return AiTestStatus.no_quota;
  if (status === 404) return AiTestStatus.model_unavailable;
  if (status === 400) {
    const message = error instanceof OpenAI.APIError ? String(error.message) : "";
    if (/model/i.test(message)) return AiTestStatus.model_unavailable;
  }
  return AiTestStatus.unreachable;
}

export function worstStatus(...statuses: AiTestStatus[]): AiTestStatus {
  return SEVERITY_ORDER.find((candidate) => statuses.includes(candidate)) ?? AiTestStatus.unreachable;
}

/**
 * Thin wrapper around the `openai` SDK, pointed at whichever OpenAI-compatible
 * provider the caller supplies. The client is built PER CALL from an
 * AiRuntimeConfig — this service holds no key and no client, so two requests
 * running under different user credentials can never share state.
 */
@Injectable()
export class AiService {
  constructor(private readonly config: ConfigService) {}

  /** Fallback used when the user picked no credential. Throws 503 when unset. */
  systemRuntimeConfig(): AiRuntimeConfig {
    const apiKey = this.config.get<string>("OPENROUTER_API_KEY");
    if (!apiKey) throw notConfiguredError();
    const descriptor = PROVIDERS[AiProvider.openrouter];
    return {
      provider: AiProvider.openrouter,
      apiKey,
      baseUrl: this.config.get<string>("OPENROUTER_BASE_URL") ?? descriptor.baseUrl,
      chatModel: this.config.get<string>("OPENROUTER_CHAT_MODEL") ?? descriptor.defaultChatModel,
      embedModel: this.config.get<string>("OPENROUTER_EMBED_MODEL") ?? descriptor.defaultEmbedModel
    };
  }

  isSystemConfigured(): boolean {
    return Boolean(this.config.get<string>("OPENROUTER_API_KEY"));
  }

  private client(cfg: AiRuntimeConfig): OpenAI {
    return new OpenAI({ apiKey: cfg.apiKey, baseURL: cfg.baseUrl });
  }

  async embed(text: string, cfg: AiRuntimeConfig): Promise<number[]> {
    let embedding: number[] | undefined;
    try {
      const response = await withTimeout(
        this.client(cfg).embeddings.create({ model: cfg.embedModel, input: text })
      );
      embedding = response.data[0]?.embedding;
    } catch {
      throw aiFailedError();
    }
    if (!embedding || embedding.length === 0) throw aiFailedError();
    return embedding;
  }

  async generateReport(
    cvText: string,
    jdText: string,
    scores: MatchScores,
    cfg: AiRuntimeConfig
  ): Promise<MatchReport> {
    const prompt = [
      "You are a recruiting assistant comparing a candidate CV against a job description (JD).",
      `Overall match score: ${scores.overallScore}%. Semantic similarity: ${scores.semanticScore}%. Keyword overlap: ${scores.keywordScore}%.`,
      "Based on the CV and JD below, list concrete strengths (what matches well), gaps (what is missing or weak), and suggestions (concrete ways to improve the CV for this JD).",
      'Respond ONLY with a JSON object of shape { "strengths": string[], "gaps": string[], "suggestions": string[] }.',
      "--- JD ---",
      jdText,
      "--- CV ---",
      cvText
    ].join("\n\n");

    let content: string | null | undefined;
    try {
      const response = await withTimeout(
        this.client(cfg).chat.completions.create({
          model: cfg.chatModel,
          messages: [
            { role: "system", content: "You are a recruiting assistant. Respond ONLY with JSON." },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      );
      content = response.choices[0]?.message?.content;
    } catch {
      throw aiFailedError();
    }
    if (!content) throw aiFailedError();

    try {
      const parsed: unknown = JSON.parse(content);
      const record = parsed as Record<string, unknown>;
      return {
        strengths: toStringArray(record.strengths),
        gaps: toStringArray(record.gaps),
        suggestions: toStringArray(record.suggestions)
      };
    } catch {
      throw aiFailedError();
    }
  }

  /**
   * Exercise BOTH capabilities the hybrid engine needs. Testing only one would
   * report a false "ok" for a key that can chat but cannot embed.
   */
  async ping(cfg: AiRuntimeConfig): Promise<{ chat: AiTestStatus; embed: AiTestStatus }> {
    const client = this.client(cfg);

    const chat = withTimeout(
      client.chat.completions.create({
        model: cfg.chatModel,
        max_tokens: PING_MAX_TOKENS,
        messages: [{ role: "user", content: PING_INPUT }]
      })
    )
      .then(() => AiTestStatus.ok)
      .catch((error: unknown) => mapProviderError(error));

    const embed = withTimeout(
      client.embeddings.create({ model: cfg.embedModel, input: PING_INPUT })
    )
      .then(() => AiTestStatus.ok)
      .catch((error: unknown) => mapProviderError(error));

    const [chatStatus, embedStatus] = await Promise.all([chat, embed]);
    return { chat: chatStatus, embed: embedStatus };
  }
}
```

Create `server/src/modules/ai/i18n-messages.ts`:

```ts
import { I18nContext } from "nestjs-i18n";

/**
 * Translate an `ai.*` key for the current request language, falling back to
 * the given English string when no I18nContext is bound.
 */
export function tAi(key: string, fallback: string): string {
  return I18nContext.current()?.t(key as never) ?? fallback;
}
```

Create `server/src/modules/ai/ai.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";

@Module({
  providers: [AiService],
  exports: [AiService]
})
export class AiModule {}
```

- [ ] **Step 4: Move the i18n keys**

Create `server/src/i18n/en/ai.json`:

```json
{
  "errors": {
    "notConfigured": "Matching service is not configured. Please contact the administrator.",
    "aiFailed": "Matching service failed. Please try again later."
  }
}
```

Create `server/src/i18n/vi/ai.json` with the existing Vietnamese strings copied from `vi/matching.json` for those two keys. Then **remove** `notConfigured` and `aiFailed` from both `en/matching.json` and `vi/matching.json`, leaving `documentNotOwned`, `invalidDocumentKind`, `matchNotFound`.

- [ ] **Step 5: Rewire matching**

`server/src/modules/matching/matching.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { MatchingController } from "./matching.controller";
import { MatchingService } from "./matching.service";

@Module({
  imports: [AiModule],
  controllers: [MatchingController],
  providers: [MatchingService]
})
export class MatchingModule {}
```

In `matching.service.ts`, change the import of `AiService`/`MatchReport` to `../ai/ai.service`, and change `run` to take the config through:

```ts
  /** Runs the hybrid engine (embed x2 + cosine + keyword + AI report) over raw text. */
  async run(
    rawCvText: string,
    rawJdText: string,
    cfg: AiRuntimeConfig
  ): Promise<MatchRunResult> {
    const cvText = capForMatch(rawCvText);
    const jdText = capForMatch(rawJdText);
    const [cvEmbedding, jdEmbedding] = await Promise.all([
      this.ai.embed(cvText, cfg),
      this.ai.embed(jdText, cfg)
    ]);
    const semanticScore = clampPercent(
      Math.round(this.cosine(cvEmbedding, jdEmbedding) * 100)
    );
    const keywordScoreValue = this.keywordScore(cvText, jdText);
    const overallScore = this.combineOverall(semanticScore, keywordScoreValue);
    const report = await this.ai.generateReport(
      cvText,
      jdText,
      { overallScore, semanticScore, keywordScore: keywordScoreValue },
      cfg
    );
    return { overallScore, semanticScore, keywordScore: keywordScoreValue, report };
  }
```

In `createMatch`, temporarily call `this.run(cvDoc.rawText, jdDoc.rawText, this.ai.systemRuntimeConfig())` and pass the four new columns from that config — Task 5 replaces the config source with the user's credential. Register `AiModule` in `app.module.ts` is **not** needed (it is imported by the modules that use it).

- [ ] **Step 6: Update `ai.service.spec.ts`**

Every existing call site gains a config argument. Add a fixture at the top of the spec and thread it through:

```ts
const CFG: AiRuntimeConfig = {
  provider: "openrouter",
  apiKey: "test-key-0000000000000000",
  baseUrl: "https://openrouter.ai/api/v1",
  chatModel: "openai/gpt-4o-mini",
  embedModel: "openai/text-embedding-3-small"
};
```

Add new cases for the classifier:

```ts
describe("mapProviderError", () => {
  const apiError = (status: number, message = "boom") =>
    new OpenAI.APIError(status, { error: { message } }, message, undefined);

  it("maps auth failures to invalid_key", () => {
    expect(mapProviderError(apiError(401))).toBe("invalid_key");
    expect(mapProviderError(apiError(403))).toBe("invalid_key");
  });

  it("maps payment and rate limits to no_quota", () => {
    expect(mapProviderError(apiError(402))).toBe("no_quota");
    expect(mapProviderError(apiError(429))).toBe("no_quota");
  });

  it("maps 404 and model-shaped 400s to model_unavailable", () => {
    expect(mapProviderError(apiError(404))).toBe("model_unavailable");
    expect(mapProviderError(apiError(400, "The model `nope` does not exist"))).toBe("model_unavailable");
  });

  it("maps anything else to unreachable", () => {
    expect(mapProviderError(new Error("socket hang up"))).toBe("unreachable");
    expect(mapProviderError(apiError(500))).toBe("unreachable");
  });
});

describe("worstStatus", () => {
  it("returns ok only when every capability is ok", () => {
    expect(worstStatus("ok", "ok")).toBe("ok");
  });

  it("returns the most severe failure", () => {
    expect(worstStatus("ok", "invalid_key")).toBe("invalid_key");
    expect(worstStatus("model_unavailable", "no_quota")).toBe("no_quota");
    expect(worstStatus("unreachable", "model_unavailable")).toBe("model_unavailable");
  });
});
```

- [ ] **Step 7: Run tests + quality gate + commit**

Run: `yarn test` — all specs pass, including the untouched `matching.service.spec.ts`.

```bash
yarn format && yarn lint && yarn type-check && yarn test && yarn build
git add src prisma
git commit -m "refactor(ai): extract AiModule with per-request provider config"
```

---

### Task 4: `ai-credentials` module

**Files:**
- Create: `server/src/modules/ai-credentials/ai-credentials.module.ts`
- Create: `server/src/modules/ai-credentials/ai-credentials.controller.ts`
- Create: `server/src/modules/ai-credentials/ai-credentials.service.ts`
- Create: `server/src/modules/ai-credentials/ai-credentials.service.spec.ts`
- Create: `server/src/modules/ai-credentials/i18n-messages.ts`
- Create: `server/src/modules/ai-credentials/dto/{create-ai-credential,update-ai-credential,ai-credential,test-result,provider-info}.dto.ts`
- Create: `server/src/i18n/en/aiCredentials.json`, `server/src/i18n/vi/aiCredentials.json`
- Modify: `server/src/app.module.ts`

**Interfaces:**
- Consumes: `CredentialCryptoService` (Task 1), `AiService.ping` + `resolveModels` + `PROVIDERS` (Task 3), Prisma `AiCredential` (Task 2).
- Produces:
  - `AiCredentialsService.list(): Promise<AiCredentialDto[]>`
  - `.create(dto: CreateAiCredentialDto): Promise<AiCredentialDto>`
  - `.update(id: string, dto: UpdateAiCredentialDto): Promise<AiCredentialDto>`
  - `.remove(id: string): Promise<void>`
  - `.test(id: string): Promise<TestResultDto>`
  - `.getRuntimeConfig(id: string): Promise<AiRuntimeConfig>` ← consumed by Task 5
  - `.listProviders(): ProviderInfoDto[]`
  - `AiCredentialsModule` exporting `AiCredentialsService`

- [ ] **Step 1: Write the DTOs**

`dto/create-ai-credential.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { AiProvider } from "@prisma/client";
import { IsEnum, IsOptional, IsString, Length, Matches } from "class-validator";

const NO_WHITESPACE = /^\S+$/;

export class CreateAiCredentialDto {
  @ApiProperty({ enum: AiProvider })
  @IsEnum(AiProvider)
  provider: AiProvider;

  @ApiProperty({ description: "User-chosen name, unique per user", example: "My OpenRouter key" })
  @IsString()
  @Length(1, 60)
  label: string;

  @ApiProperty({
    writeOnly: true,
    description: "Provider API key. Stored encrypted; never returned by any endpoint.",
    example: "sk-xxxxxxxxxxxxxxxxxxxxxxxx"
  })
  @IsString()
  @Length(20, 400)
  @Matches(NO_WHITESPACE, { message: "apiKey must not contain whitespace" })
  apiKey: string;

  @ApiProperty({ required: false, description: "Blank uses the provider default" })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(NO_WHITESPACE)
  chatModel?: string;

  @ApiProperty({ required: false, description: "Blank uses the provider default" })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(NO_WHITESPACE)
  embedModel?: string;
}
```

`dto/update-ai-credential.dto.ts` — same shape minus `provider`, everything optional (provider is immutable; changing it would invalidate the stored model names):

```ts
import { ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, Length, Matches } from "class-validator";

const NO_WHITESPACE = /^\S+$/;

export class UpdateAiCredentialDto {
  @ApiProperty({ required: false })
  @IsOptional() @IsString() @Length(1, 60)
  label?: string;

  @ApiProperty({ required: false, writeOnly: true, description: "Omit to keep the stored key" })
  @IsOptional() @IsString() @Length(20, 400) @Matches(NO_WHITESPACE)
  apiKey?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @Length(1, 120) @Matches(NO_WHITESPACE)
  chatModel?: string;

  @ApiProperty({ required: false })
  @IsOptional() @IsString() @Length(1, 120) @Matches(NO_WHITESPACE)
  embedModel?: string;
}
```

`dto/ai-credential.dto.ts` — note there is deliberately **no** field for the ciphertext trio:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { AiCredential, AiProvider, AiTestStatus } from "@prisma/client";

export class AiCredentialDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: AiProvider }) provider: AiProvider;
  @ApiProperty() label: string;
  @ApiProperty({ description: "Last 4 characters only — not enough to reuse the key" })
  keyLast4: string;
  @ApiProperty({ nullable: true }) chatModel: string | null;
  @ApiProperty({ nullable: true }) embedModel: string | null;
  @ApiProperty({ enum: AiTestStatus, nullable: true }) lastTestStatus: AiTestStatus | null;
  @ApiProperty({ nullable: true }) lastTestedAt: Date | null;
  @ApiProperty({ nullable: true }) lastUsedAt: Date | null;
  @ApiProperty() createdAt: Date;

  static fromEntity(entity: AiCredential): AiCredentialDto {
    const dto = new AiCredentialDto();
    dto.id = entity.id;
    dto.provider = entity.provider;
    dto.label = entity.label;
    dto.keyLast4 = entity.keyLast4;
    dto.chatModel = entity.chatModel;
    dto.embedModel = entity.embedModel;
    dto.lastTestStatus = entity.lastTestStatus;
    dto.lastTestedAt = entity.lastTestedAt;
    dto.lastUsedAt = entity.lastUsedAt;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
```

`dto/test-result.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { AiTestStatus } from "@prisma/client";

export class TestResultDto {
  @ApiProperty({ enum: AiTestStatus, description: "Worst of chat and embed" })
  status: AiTestStatus;
  @ApiProperty({ enum: AiTestStatus }) chat: AiTestStatus;
  @ApiProperty({ enum: AiTestStatus }) embed: AiTestStatus;
  @ApiProperty() testedAt: Date;
}
```

`dto/provider-info.dto.ts`:

```ts
import { ApiProperty } from "@nestjs/swagger";
import { AiProvider } from "@prisma/client";

export class ProviderInfoDto {
  @ApiProperty({ enum: AiProvider }) id: AiProvider;
  @ApiProperty() label: string;
  @ApiProperty() defaultChatModel: string;
  @ApiProperty() defaultEmbedModel: string;
}
```

- [ ] **Step 2: Write the failing service test**

Create `server/src/modules/ai-credentials/ai-credentials.service.spec.ts`:

```ts
import { ConflictException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { AiTestStatus, Prisma } from "@prisma/client";
import { AiCredentialsService } from "./ai-credentials.service";

const USER_ID = "00000000-0000-0000-0000-000000000001";

const entity = {
  id: "cred-1",
  userId: USER_ID,
  provider: "openrouter" as const,
  label: "Mine",
  encryptedKey: Buffer.from("cipher"),
  keyIv: Buffer.from("iv"),
  keyTag: Buffer.from("tag"),
  keyLast4: "1234",
  chatModel: null,
  embedModel: null,
  lastTestStatus: AiTestStatus.ok,
  lastTestedAt: new Date("2026-08-01T00:00:00Z"),
  lastUsedAt: null,
  createdAt: new Date("2026-08-01T00:00:00Z"),
  updatedAt: new Date("2026-08-01T00:00:00Z")
};

function makeService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    aiCredential: {
      findMany: jest.fn().mockResolvedValue([entity]),
      findFirst: jest.fn().mockResolvedValue(entity),
      create: jest.fn().mockResolvedValue(entity),
      update: jest.fn().mockResolvedValue(entity),
      delete: jest.fn().mockResolvedValue(entity)
    },
    ...overrides
  };
  const crypto = {
    isConfigured: jest.fn().mockReturnValue(true),
    encrypt: jest.fn().mockReturnValue({
      ciphertext: Buffer.from("cipher"),
      iv: Buffer.from("iv"),
      tag: Buffer.from("tag")
    }),
    decrypt: jest.fn().mockReturnValue("sk-plaintext-key-000000")
  };
  const ai = { ping: jest.fn().mockResolvedValue({ chat: AiTestStatus.ok, embed: AiTestStatus.ok }) };
  const currentUser = { getUserId: jest.fn().mockReturnValue(USER_ID) };
  const service = new AiCredentialsService(
    prisma as never,
    crypto as never,
    ai as never,
    currentUser as never
  );
  return { service, prisma, crypto, ai };
}

describe("AiCredentialsService", () => {
  it("never exposes the ciphertext trio in a DTO", async () => {
    const { service } = makeService();
    const [dto] = await service.list();
    expect(JSON.stringify(dto)).not.toContain("cipher");
    expect(dto).not.toHaveProperty("encryptedKey");
    expect(dto).not.toHaveProperty("keyIv");
    expect(dto).not.toHaveProperty("keyTag");
  });

  it("stores only the last 4 characters for display", async () => {
    const { service, prisma } = makeService();
    await service.create({
      provider: "openrouter",
      label: "Mine",
      apiKey: "sk-abcdefghijklmnop9876"
    });
    expect(prisma.aiCredential.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ keyLast4: "9876" }) })
    );
  });

  it("turns a unique-constraint violation into 409", async () => {
    const { service, prisma } = makeService();
    prisma.aiCredential.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("dup", { code: "P2002", clientVersion: "6" })
    );
    await expect(
      service.create({ provider: "openrouter", label: "Mine", apiKey: "sk-abcdefghijklmnop9876" })
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("resets the test status when the key changes", async () => {
    const { service, prisma } = makeService();
    await service.update("cred-1", { apiKey: "sk-brand-new-key-00000000" });
    expect(prisma.aiCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastTestStatus: null, lastTestedAt: null })
      })
    );
  });

  it("resets the test status when a model override changes", async () => {
    const { service, prisma } = makeService();
    await service.update("cred-1", { chatModel: "gpt-4o" });
    expect(prisma.aiCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastTestStatus: null, lastTestedAt: null })
      })
    );
  });

  it("keeps the test status when only the label changes", async () => {
    const { service, prisma } = makeService();
    await service.update("cred-1", { label: "Renamed" });
    const data = prisma.aiCredential.update.mock.calls[0][0].data as Record<string, unknown>;
    expect(data).not.toHaveProperty("lastTestStatus");
  });

  it("404s for a credential the user does not own", async () => {
    const { service, prisma } = makeService();
    prisma.aiCredential.findFirst.mockResolvedValue(null);
    await expect(service.getRuntimeConfig("someone-elses")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("scopes every read by the current user", async () => {
    const { service, prisma } = makeService();
    await service.list();
    expect(prisma.aiCredential.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } })
    );
  });

  it("503s when encryption is not configured", async () => {
    const { service, crypto } = makeService();
    crypto.isConfigured.mockReturnValue(false);
    await expect(service.list()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("records the worst of chat and embed as the stored status", async () => {
    const { service, ai, prisma } = makeService();
    ai.ping.mockResolvedValue({ chat: AiTestStatus.ok, embed: AiTestStatus.model_unavailable });
    const result = await service.test("cred-1");
    expect(result.status).toBe(AiTestStatus.model_unavailable);
    expect(result.chat).toBe(AiTestStatus.ok);
    expect(result.embed).toBe(AiTestStatus.model_unavailable);
    expect(prisma.aiCredential.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastTestStatus: AiTestStatus.model_unavailable })
      })
    );
  });

  it("resolves a runtime config with the decrypted key and default models", async () => {
    const { service } = makeService();
    const cfg = await service.getRuntimeConfig("cred-1");
    expect(cfg).toEqual({
      provider: "openrouter",
      apiKey: "sk-plaintext-key-000000",
      baseUrl: "https://openrouter.ai/api/v1",
      chatModel: "openai/gpt-4o-mini",
      embedModel: "openai/text-embedding-3-small"
    });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `yarn test ai-credentials.service`
Expected: FAIL — module not found.

- [ ] **Step 4: Write the service**

`server/src/modules/ai-credentials/i18n-messages.ts`:

```ts
import { I18nContext } from "nestjs-i18n";

/** Translate an `aiCredentials.*` key, falling back to English outside a request. */
export function tCred(key: string, fallback: string): string {
  return I18nContext.current()?.t(key as never) ?? fallback;
}
```

`server/src/modules/ai-credentials/ai-credentials.service.ts`:

```ts
import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { AiCredential, AiProvider, Prisma } from "@prisma/client";
import { CredentialCryptoService } from "../../common/crypto/credential-crypto.service";
import { CurrentUserService } from "../../common/current-user/current-user.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AiService, worstStatus } from "../ai/ai.service";
import { AiRuntimeConfig, PROVIDERS, resolveModels } from "../ai/providers";
import { AiCredentialDto } from "./dto/ai-credential.dto";
import { CreateAiCredentialDto } from "./dto/create-ai-credential.dto";
import { ProviderInfoDto } from "./dto/provider-info.dto";
import { TestResultDto } from "./dto/test-result.dto";
import { UpdateAiCredentialDto } from "./dto/update-ai-credential.dto";
import { tCred } from "./i18n-messages";

const KEY_LAST4_LENGTH = 4;
const UNIQUE_VIOLATION = "P2002";

// Display names for the provider whitelist. The enum value is the API contract;
// this is only what a human reads.
const PROVIDER_LABELS: Record<AiProvider, string> = {
  openrouter: "OpenRouter",
  openai: "OpenAI",
  gemini: "Google Gemini"
};

/** Blank/whitespace-only override means "use the provider default", stored as null. */
function normaliseOverride(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

@Injectable()
export class AiCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly ai: AiService,
    private readonly currentUser: CurrentUserService
  ) {}

  private requireCrypto(): void {
    if (!this.crypto.isConfigured()) {
      throw new ServiceUnavailableException(
        tCred(
          "aiCredentials.errors.cryptoNotConfigured",
          "Credential storage is not configured. Please contact the administrator."
        )
      );
    }
  }

  private async findOwned(id: string): Promise<AiCredential> {
    const userId = this.currentUser.getUserId();
    const found = await this.prisma.aiCredential.findFirst({ where: { id, userId } });
    if (!found) {
      throw new NotFoundException(
        tCred("aiCredentials.errors.notFound", "Credential not found.")
      );
    }
    return found;
  }

  listProviders(): ProviderInfoDto[] {
    return (Object.keys(PROVIDERS) as AiProvider[]).map((id) => ({
      id,
      label: PROVIDER_LABELS[id],
      defaultChatModel: PROVIDERS[id].defaultChatModel,
      defaultEmbedModel: PROVIDERS[id].defaultEmbedModel
    }));
  }

  async list(): Promise<AiCredentialDto[]> {
    this.requireCrypto();
    const userId = this.currentUser.getUserId();
    const rows = await this.prisma.aiCredential.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" }
    });
    return rows.map((row) => AiCredentialDto.fromEntity(row));
  }

  async create(dto: CreateAiCredentialDto): Promise<AiCredentialDto> {
    this.requireCrypto();
    const userId = this.currentUser.getUserId();
    const { ciphertext, iv, tag } = this.crypto.encrypt(dto.apiKey);
    try {
      const created = await this.prisma.aiCredential.create({
        data: {
          userId,
          provider: dto.provider,
          label: dto.label.trim(),
          encryptedKey: ciphertext,
          keyIv: iv,
          keyTag: tag,
          keyLast4: dto.apiKey.slice(-KEY_LAST4_LENGTH),
          chatModel: normaliseOverride(dto.chatModel) ?? null,
          embedModel: normaliseOverride(dto.embedModel) ?? null
        }
      });
      return AiCredentialDto.fromEntity(created);
    } catch (error) {
      throw this.asDomainError(error);
    }
  }

  async update(id: string, dto: UpdateAiCredentialDto): Promise<AiCredentialDto> {
    this.requireCrypto();
    await this.findOwned(id);

    const data: Prisma.AiCredentialUpdateInput = {};
    if (dto.label !== undefined) data.label = dto.label.trim();

    const chatModel = normaliseOverride(dto.chatModel);
    const embedModel = normaliseOverride(dto.embedModel);
    if (chatModel !== undefined) data.chatModel = chatModel;
    if (embedModel !== undefined) data.embedModel = embedModel;

    if (dto.apiKey !== undefined) {
      const { ciphertext, iv, tag } = this.crypto.encrypt(dto.apiKey);
      data.encryptedKey = ciphertext;
      data.keyIv = iv;
      data.keyTag = tag;
      data.keyLast4 = dto.apiKey.slice(-KEY_LAST4_LENGTH);
    }

    // A new key or a different model means the stored verdict no longer
    // describes what would actually run — clear it rather than show a stale OK.
    if (dto.apiKey !== undefined || chatModel !== undefined || embedModel !== undefined) {
      data.lastTestStatus = null;
      data.lastTestedAt = null;
    }

    try {
      const updated = await this.prisma.aiCredential.update({ where: { id }, data });
      return AiCredentialDto.fromEntity(updated);
    } catch (error) {
      throw this.asDomainError(error);
    }
  }

  async remove(id: string): Promise<void> {
    this.requireCrypto();
    await this.findOwned(id);
    await this.prisma.aiCredential.delete({ where: { id } });
  }

  async test(id: string): Promise<TestResultDto> {
    this.requireCrypto();
    const cfg = await this.getRuntimeConfig(id);
    const { chat, embed } = await this.ai.ping(cfg);
    const status = worstStatus(chat, embed);
    const testedAt = new Date();
    await this.prisma.aiCredential.update({
      where: { id },
      data: { lastTestStatus: status, lastTestedAt: testedAt }
    });
    return { status, chat, embed, testedAt };
  }

  /**
   * The ONLY place a plaintext key is materialised. The returned object is an
   * internal runtime type: it must never be returned from a controller,
   * serialised into a response, or logged.
   */
  async getRuntimeConfig(id: string): Promise<AiRuntimeConfig> {
    this.requireCrypto();
    const credential = await this.findOwned(id);
    const apiKey = this.crypto.decrypt({
      ciphertext: credential.encryptedKey,
      iv: credential.keyIv,
      tag: credential.keyTag
    });
    const { baseUrl, chatModel, embedModel } = resolveModels(
      credential.provider,
      credential.chatModel,
      credential.embedModel
    );
    return { provider: credential.provider, apiKey, baseUrl, chatModel, embedModel };
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.aiCredential.update({ where: { id }, data: { lastUsedAt: new Date() } });
  }

  private asDomainError(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === UNIQUE_VIOLATION
    ) {
      return new ConflictException(
        tCred("aiCredentials.errors.labelTaken", "You already have a credential with this name.")
      );
    }
    return error;
  }
}
```

- [ ] **Step 5: Write the controller and module**

`ai-credentials.controller.ts` — note `providers` is declared **before** `:id` so it is not captured as a param:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags
} from "@nestjs/swagger";
import { AiCredentialsService } from "./ai-credentials.service";
import { AiCredentialDto } from "./dto/ai-credential.dto";
import { CreateAiCredentialDto } from "./dto/create-ai-credential.dto";
import { ProviderInfoDto } from "./dto/provider-info.dto";
import { TestResultDto } from "./dto/test-result.dto";
import { UpdateAiCredentialDto } from "./dto/update-ai-credential.dto";

// Tighter than the global 100/60s: this endpoint spends the user's provider
// quota and would otherwise let the app be used as a key-validation oracle.
const TEST_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags("ai-credentials")
@Controller("ai-credentials")
export class AiCredentialsController {
  constructor(private readonly service: AiCredentialsService) {}

  @Get("providers")
  @ApiOkResponse({ type: [ProviderInfoDto] })
  listProviders(): ProviderInfoDto[] {
    return this.service.listProviders();
  }

  @Get()
  @ApiOkResponse({ type: [AiCredentialDto] })
  async list(): Promise<AiCredentialDto[]> {
    return this.service.list();
  }

  @Post()
  @ApiCreatedResponse({ type: AiCredentialDto })
  async create(@Body() dto: CreateAiCredentialDto): Promise<AiCredentialDto> {
    return this.service.create(dto);
  }

  @Patch(":id")
  @ApiOkResponse({ type: AiCredentialDto })
  async update(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateAiCredentialDto
  ): Promise<AiCredentialDto> {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  async remove(@Param("id", new ParseUUIDPipe()) id: string): Promise<void> {
    return this.service.remove(id);
  }

  @Post(":id/test")
  @Throttle(TEST_THROTTLE)
  @ApiOkResponse({ type: TestResultDto })
  async test(@Param("id", new ParseUUIDPipe()) id: string): Promise<TestResultDto> {
    return this.service.test(id);
  }
}
```

`ai-credentials.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { CryptoModule } from "../../common/crypto/crypto.module";
import { AiModule } from "../ai/ai.module";
import { AiCredentialsController } from "./ai-credentials.controller";
import { AiCredentialsService } from "./ai-credentials.service";

@Module({
  imports: [CryptoModule, AiModule],
  controllers: [AiCredentialsController],
  providers: [AiCredentialsService],
  exports: [AiCredentialsService]
})
export class AiCredentialsModule {}
```

Register it in `app.module.ts` imports, after `MatchingModule`.

- [ ] **Step 6: Write the i18n files**

`server/src/i18n/en/aiCredentials.json`:

```json
{
  "errors": {
    "notFound": "Credential not found.",
    "labelTaken": "You already have a credential with this name.",
    "cryptoNotConfigured": "Credential storage is not configured. Please contact the administrator."
  }
}
```

`server/src/i18n/vi/aiCredentials.json`:

```json
{
  "errors": {
    "notFound": "Không tìm thấy credential.",
    "labelTaken": "Bạn đã có một credential trùng tên này.",
    "cryptoNotConfigured": "Kho credential chưa được cấu hình. Vui lòng liên hệ quản trị viên."
  }
}
```

- [ ] **Step 7: Run tests, quality gate, commit**

Run: `yarn test ai-credentials.service` → PASS (12 tests).

```bash
yarn format && yarn lint && yarn type-check && yarn test && yarn build
git add src
git commit -m "feat(ai-credentials): CRUD, encryption and connection testing"
```

---

### Task 5: Wire credential selection into matching

**Files:**
- Modify: `server/src/modules/matching/dto/create-match.dto.ts`
- Modify: `server/src/modules/matching/dto/match-result.dto.ts`
- Modify: `server/src/modules/matching/matching.service.ts`
- Modify: `server/src/modules/matching/matching.module.ts`
- Modify: `server/src/modules/matching/matching.service.spec.ts`

**Interfaces:**
- Consumes: `AiCredentialsService.getRuntimeConfig`, `.markUsed` (Task 4); `AiService.systemRuntimeConfig` (Task 3).
- Produces: `MatchResultDto` gains `credentialId: string | null`, `provider: AiProvider`, `chatModel: string`, `embedModel: string` — consumed by FE Task 7.

- [ ] **Step 1: Write the failing test**

Append to `server/src/modules/matching/matching.service.spec.ts`:

```ts
describe("createMatch provider snapshot", () => {
  it("uses the system config and stores a null credentialId when none is given", async () => {
    const { service, prisma, ai } = makeMatchingService();
    await service.createMatch({ cvDocumentId: CV_ID, jdDocumentId: JD_ID });
    expect(ai.systemRuntimeConfig).toHaveBeenCalled();
    expect(prisma.matchResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          credentialId: null,
          provider: "openrouter",
          chatModel: "openai/gpt-4o-mini",
          embedModel: "openai/text-embedding-3-small"
        })
      })
    );
  });

  it("uses the chosen credential and stamps lastUsedAt", async () => {
    const { service, prisma, credentials } = makeMatchingService();
    credentials.getRuntimeConfig.mockResolvedValue({
      provider: "gemini",
      apiKey: "secret",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
      chatModel: "gemini-2.5-flash",
      embedModel: "gemini-embedding-001"
    });
    await service.createMatch({
      cvDocumentId: CV_ID,
      jdDocumentId: JD_ID,
      credentialId: CRED_ID
    });
    expect(prisma.matchResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          credentialId: CRED_ID,
          provider: "gemini",
          chatModel: "gemini-2.5-flash"
        })
      })
    );
    expect(credentials.markUsed).toHaveBeenCalledWith(CRED_ID);
  });

  it("never puts the plaintext key on the returned DTO", async () => {
    const { service, credentials } = makeMatchingService();
    credentials.getRuntimeConfig.mockResolvedValue({
      provider: "openrouter",
      apiKey: "sk-should-never-appear",
      baseUrl: "https://openrouter.ai/api/v1",
      chatModel: "openai/gpt-4o-mini",
      embedModel: "openai/text-embedding-3-small"
    });
    const dto = await service.createMatch({
      cvDocumentId: CV_ID,
      jdDocumentId: JD_ID,
      credentialId: CRED_ID
    });
    expect(JSON.stringify(dto)).not.toContain("sk-should-never-appear");
  });
});
```

Extend the existing `makeMatchingService` helper in that spec so its mock `ai` has `systemRuntimeConfig: jest.fn().mockReturnValue({ provider: "openrouter", apiKey: "k", baseUrl: "https://openrouter.ai/api/v1", chatModel: "openai/gpt-4o-mini", embedModel: "openai/text-embedding-3-small" })`, and add a fourth constructor argument `credentials` with `getRuntimeConfig: jest.fn()` and `markUsed: jest.fn()`. Declare `const CRED_ID = "11111111-1111-1111-1111-111111111111";`.

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test matching.service`
Expected: FAIL — `credentialId` unknown / `credentials` undefined.

- [ ] **Step 3: Extend the DTOs**

In `create-match.dto.ts` add:

```ts
  @ApiProperty({
    required: false,
    description:
      "id of one of the current user's AiCredentials. Omit to run on the system key."
  })
  @IsOptional()
  @IsUUID()
  credentialId?: string;
```

(import `IsOptional` alongside `IsUUID`.)

In `match-result.dto.ts` add the four fields and map them in `fromEntity`:

```ts
  @ApiProperty({ nullable: true, description: "null means the system key was used" })
  credentialId: string | null;
  @ApiProperty({ enum: AiProvider }) provider: AiProvider;
  @ApiProperty() chatModel: string;
  @ApiProperty() embedModel: string;
```

```ts
    dto.credentialId = entity.credentialId;
    dto.provider = entity.provider;
    dto.chatModel = entity.chatModel;
    dto.embedModel = entity.embedModel;
```

- [ ] **Step 4: Implement the service change**

In `matching.service.ts`, inject the credentials service and resolve the config:

```ts
  constructor(
    private readonly ai: AiService,
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService,
    private readonly credentials: AiCredentialsService
  ) {}
```

Replace the body of `createMatch` after the document checks with:

```ts
    const runtime = dto.credentialId
      ? await this.credentials.getRuntimeConfig(dto.credentialId)
      : this.ai.systemRuntimeConfig();

    const result = await this.run(cvDoc.rawText, jdDoc.rawText, runtime);

    const created = await this.prisma.matchResult.create({
      data: {
        userId,
        cvDocumentId: cvDoc.id,
        jdDocumentId: jdDoc.id,
        credentialId: dto.credentialId ?? null,
        provider: runtime.provider,
        chatModel: runtime.chatModel,
        embedModel: runtime.embedModel,
        overallScore: result.overallScore,
        semanticScore: result.semanticScore,
        keywordScore: result.keywordScore,
        report: result.report as unknown as Prisma.InputJsonValue
      }
    });

    // Audit stamp only — a failure here must not lose a match the user paid for.
    if (dto.credentialId) await this.credentials.markUsed(dto.credentialId);

    return MatchResultDto.fromEntity(created);
```

Add `AiCredentialsModule` to `MatchingModule`'s `imports`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn test matching`
Expected: PASS.

- [ ] **Step 6: Quality gate + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test && yarn build
git add src
git commit -m "feat(matching): run a match with a chosen credential and snapshot the provider"
```

---

### Task 6: Backend e2e spec

**Files:**
- Create: `server/test/ai-credentials.e2e-spec.ts`

**Interfaces:**
- Consumes: the whole HTTP surface from Tasks 4–5.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the spec**

Model it on the existing `server/test/documents.e2e-spec.ts` bootstrap (same `Test.createTestingModule({ imports: [AppModule] })`, same global pipe setup and `api/v1` prefix). Mock the `openai` SDK at module scope so no network call is made:

```ts
jest.mock("openai", () => {
  const create = jest.fn().mockResolvedValue({ data: [{ embedding: [1, 0] }] });
  class MockOpenAI {
    embeddings = { create };
    chat = { completions: { create: jest.fn().mockResolvedValue({ choices: [{ message: { content: "{}" } }] }) } };
  }
  return { __esModule: true, default: MockOpenAI, APIError: class extends Error {} };
});
```

Cover, in order:

1. `GET /api/v1/ai-credentials/providers` → 200, exactly three entries, ids `openrouter`/`openai`/`gemini`, each with non-empty `defaultChatModel` and `defaultEmbedModel`.
2. `POST /api/v1/ai-credentials` with a valid body → 201; body has `keyLast4` equal to the last four characters and **no** `apiKey`/`encryptedKey`/`keyIv`/`keyTag` key.
3. **Leak assertion**: `expect(JSON.stringify(response.body)).not.toContain(API_KEY)` where `API_KEY` is the submitted key.
4. `POST` the same label twice → second call 409.
5. Boundary rejects: `apiKey` of 19 chars → 400; `apiKey` of 401 chars → 400; `apiKey` containing a space → 400; `label` of 61 chars → 400. Accepts: `apiKey` of exactly 20 and exactly 400 chars → 201; `label` of exactly 1 and exactly 60 chars → 201.
6. `PATCH` with a new `apiKey` → 200, `lastTestStatus` is `null`, `keyLast4` updated.
7. `GET /api/v1/ai-credentials` → the created rows, newest first.
8. `DELETE` → 204, then `PATCH` on the same id → 404.
9. **Ownership**: insert a credential for a different `userId` directly through Prisma, then `GET`/`PATCH`/`DELETE`/`POST :id/test` on it → 404 every time, and it must not appear in the list. *(This is where E2E matrix row 3 is covered — the FE cannot test it because only one mock user exists.)*
10. **Crypto not configured**: build a second Nest app whose `ConfigService` returns `undefined` for `CREDENTIAL_ENCRYPTION_KEY` (override the provider with `.overrideProvider(CredentialCryptoService)` using an instance constructed without a key) → `GET /api/v1/ai-credentials` returns 503.

Clean up every row created by the spec in `afterAll` via Prisma.

- [ ] **Step 2: Run it**

Run: `yarn test:e2e ai-credentials`
Expected: PASS.

- [ ] **Step 3: Quality gate + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test && yarn test:e2e && yarn build
git add test
git commit -m "test(ai-credentials): e2e covering ownership, leak safety and boundaries"
```

---

### Task 7: Frontend data layer

**Files:**
- Create: `client/src/types/AiCredentials/index.ts`
- Create: `client/src/requests/aiCredentials.ts`
- Create: `client/src/hooks/useAiCredentials.ts`
- Modify: `client/src/constants/endpoints.ts`
- Modify: `client/src/hooks/index.ts`
- Modify: `client/src/types/Matching/index.ts`

**Interfaces:**
- Consumes: BE contract from Tasks 4–5.
- Produces: `AiProvider`, `AiTestStatus`, `AiCredentialDto`, `ProviderInfoDto`, `TestResultDto`, `CreateCredentialInput`, `UpdateCredentialInput`; hooks `useAiCredentials()`, `useProviders()`, `useCreateCredential()`, `useUpdateCredential()`, `useDeleteCredential()`, `useTestCredential()`; query keys `aiCredentialsQueryKey()`, `aiProvidersQueryKey()`.

- [ ] **Step 1: Write the types**

`client/src/types/AiCredentials/index.ts`:

```ts
// Mirrors server/src/modules/ai-credentials/dto/*. Keep in sync with the BE DTOs.

export type AiProvider = "openrouter" | "openai" | "gemini";

export type AiTestStatus =
  | "ok"
  | "invalid_key"
  | "no_quota"
  | "model_unavailable"
  | "unreachable";

export interface AiCredentialDto {
  id: string;
  provider: AiProvider;
  label: string;
  /** Last 4 characters only — the full key is never sent to the client. */
  keyLast4: string;
  chatModel: string | null;
  embedModel: string | null;
  lastTestStatus: AiTestStatus | null;
  lastTestedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface ProviderInfoDto {
  id: AiProvider;
  label: string;
  defaultChatModel: string;
  defaultEmbedModel: string;
}

export interface TestResultDto {
  status: AiTestStatus;
  chat: AiTestStatus;
  embed: AiTestStatus;
  testedAt: string;
}

export interface CreateCredentialInput {
  provider: AiProvider;
  label: string;
  apiKey: string;
  chatModel?: string;
  embedModel?: string;
}

export interface UpdateCredentialInput {
  label?: string;
  /** Omit to keep the stored key. */
  apiKey?: string;
  chatModel?: string;
  embedModel?: string;
}
```

Extend `client/src/types/Matching/index.ts`:

```ts
import type { AiProvider } from "#/types/AiCredentials";
```

add to `MatchResultDto`:

```ts
  credentialId: string | null;
  provider: AiProvider;
  chatModel: string;
  embedModel: string;
```

and to `CreateMatchInput`:

```ts
  /** Omit to run on the system key. */
  credentialId?: string;
```

- [ ] **Step 2: Add endpoints**

In `client/src/constants/endpoints.ts`, add:

```ts
  aiCredentials: "/ai-credentials",
  aiCredentialById: (id: string) => `/ai-credentials/${encodeURIComponent(id)}`,
  aiCredentialTest: (id: string) => `/ai-credentials/${encodeURIComponent(id)}/test`,
  aiProviders: "/ai-credentials/providers",
```

- [ ] **Step 3: Write the requests**

`client/src/requests/aiCredentials.ts`:

```ts
import { apiFetch } from "#/libs/api";
import { ENDPOINTS } from "#/constants";
import type {
  AiCredentialDto,
  CreateCredentialInput,
  ProviderInfoDto,
  TestResultDto,
  UpdateCredentialInput
} from "#/types/AiCredentials";

export function aiCredentialsQueryKey() {
  return ["ai-credentials"] as const;
}

export function aiProvidersQueryKey() {
  return ["ai-credentials", "providers"] as const;
}

/** GET /ai-credentials — the current user's credentials, newest first. */
export function fetchAiCredentials(): Promise<Array<AiCredentialDto>> {
  return apiFetch<Array<AiCredentialDto>>(ENDPOINTS.aiCredentials);
}

/** GET /ai-credentials/providers — whitelist plus each provider's default models. */
export function fetchAiProviders(): Promise<Array<ProviderInfoDto>> {
  return apiFetch<Array<ProviderInfoDto>>(ENDPOINTS.aiProviders);
}

/** POST /ai-credentials — store a new key (encrypted server-side). */
export function createAiCredential(
  input: CreateCredentialInput
): Promise<AiCredentialDto> {
  return apiFetch<AiCredentialDto>(ENDPOINTS.aiCredentials, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

/** PATCH /ai-credentials/:id — rename, change models, or rotate the key. */
export function updateAiCredential(
  id: string,
  input: UpdateCredentialInput
): Promise<AiCredentialDto> {
  return apiFetch<AiCredentialDto>(ENDPOINTS.aiCredentialById(id), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
}

/** DELETE /ai-credentials/:id — past match results keep their provider snapshot. */
export function deleteAiCredential(id: string): Promise<void> {
  return apiFetch<void>(ENDPOINTS.aiCredentialById(id), { method: "DELETE" });
}

/** POST /ai-credentials/:id/test — ping chat and embeddings with the stored key. */
export function testAiCredential(id: string): Promise<TestResultDto> {
  return apiFetch<TestResultDto>(ENDPOINTS.aiCredentialTest(id), { method: "POST" });
}
```

- [ ] **Step 4: Write the hooks**

`client/src/hooks/useAiCredentials.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  aiCredentialsQueryKey,
  aiProvidersQueryKey,
  createAiCredential,
  deleteAiCredential,
  fetchAiCredentials,
  fetchAiProviders,
  testAiCredential,
  updateAiCredential
} from "#/requests/aiCredentials";
import type { UpdateCredentialInput } from "#/types/AiCredentials";

/** GET /ai-credentials — list for the credentials page and the wizard selector. */
export function useAiCredentials() {
  return useQuery({
    queryKey: aiCredentialsQueryKey(),
    queryFn: fetchAiCredentials
  });
}

/** GET /ai-credentials/providers — static whitelist; safe to cache for the session. */
export function useProviders() {
  return useQuery({
    queryKey: aiProvidersQueryKey(),
    queryFn: fetchAiProviders,
    staleTime: Infinity
  });
}

export function useCreateCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createAiCredential,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: aiCredentialsQueryKey() })
  });
}

export function useUpdateCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCredentialInput }) =>
      updateAiCredential(id, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: aiCredentialsQueryKey() })
  });
}

export function useDeleteCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteAiCredential,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: aiCredentialsQueryKey() })
  });
}

export function useTestCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: testAiCredential,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: aiCredentialsQueryKey() })
  });
}
```

Add to `client/src/hooks/index.ts`:

```ts
export {
  useAiCredentials,
  useProviders,
  useCreateCredential,
  useUpdateCredential,
  useDeleteCredential,
  useTestCredential
} from "./useAiCredentials";
```

- [ ] **Step 5: Quality gate + commit**

```bash
cd client/.worktrees/ai-credentials
yarn format && yarn lint && yarn type-check && yarn test && yarn build
git add src
git commit -m "feat(client): data layer for AI credentials"
```

---

### Task 8: Shared components — `TestStatusTag` and `CredentialFormModal`

**Files:**
- Create: `client/src/components/TestStatusTag/index.tsx`
- Create: `client/src/components/CredentialFormModal/index.tsx`
- Create: `client/src/components/CredentialFormModal/__tests__/CredentialFormModal.test.tsx`
- Modify: `client/src/locales/en/translation.json`, `client/src/locales/vi/translation.json`

**Interfaces:**
- Consumes: Task 7 types and hooks.
- Produces:
  - `<TestStatusTag status={AiTestStatus | null} testedAt={string | null} />`
  - `<CredentialFormModal open credential={AiCredentialDto | null} onClose={() => void} onSaved={(c: AiCredentialDto) => void} />` — owns create/update + the post-save test, so both the page and the wizard get identical behaviour.

- [ ] **Step 1: Add the copy**

Add to `client/src/locales/en/translation.json` a `credentials` block (mirror it in `vi` with Vietnamese strings):

```json
"credentials": {
  "title": "AI credentials",
  "subtitle": "Your own provider keys. Matching runs on the one you pick.",
  "add": "Add credential",
  "empty": "No credentials yet",
  "emptyHint": "Matching currently runs on the system key. Add your own to use your provider account.",
  "systemKey": "System key",
  "systemKeyHint": "fallback",
  "defaultModel": "Default",
  "never": "—",
  "form": {
    "addTitle": "Add credential",
    "editTitle": "Edit credential",
    "provider": "Provider",
    "label": "Name",
    "labelPlaceholder": "My OpenRouter key",
    "apiKey": "API key",
    "apiKeyKeepHint": "Leave blank to keep the current key",
    "apiKeyStoredHint": "Encrypted at rest and never shown again.",
    "chatModel": "Chat model",
    "embedModel": "Embedding model",
    "modelHint": "Leave blank to use the provider default",
    "save": "Save",
    "testing": "Testing connection…",
    "chatResult": "Chat",
    "embedResult": "Embeddings"
  },
  "status": {
    "untested": "Not tested",
    "ok": "Tested OK",
    "invalid_key": "Invalid key",
    "no_quota": "No quota",
    "model_unavailable": "Model unavailable",
    "unreachable": "Unreachable"
  },
  "actions": { "test": "Test", "edit": "Edit", "delete": "Delete" },
  "delete": {
    "confirm": "Delete this credential?",
    "hint": "Past match results keep the provider and model they ran with.",
    "success": "Credential deleted",
    "failed": "Could not delete the credential"
  },
  "errors": {
    "loadFailed": "Could not load your credentials",
    "notConfigured": "Credential storage is not configured on the server.",
    "labelTaken": "You already have a credential with this name",
    "saveFailed": "Could not save the credential",
    "testFailed": "Could not test the credential"
  },
  "runWith": {
    "title": "Run with",
    "untestedWarning": "This credential has not been tested yet.",
    "testNow": "Test now",
    "privacy": "Your CV and JD text will be sent to {{provider}}.",
    "privacySystem": "Your CV and JD text will be sent to OpenRouter using the system key."
  }
}
```

- [ ] **Step 2: Write `TestStatusTag`**

```tsx
import { Tag, Tooltip } from "antd";
import { useTranslation } from "react-i18next";
import type { AiTestStatus } from "#/types/AiCredentials";

// Enum -> antd preset colour. Never render the raw enum value to a user.
const COLOR: Record<AiTestStatus, string> = {
  ok: "green",
  invalid_key: "red",
  no_quota: "orange",
  model_unavailable: "orange",
  unreachable: "default"
};

/** Last connection-test verdict for a credential, with a relative timestamp. */
const TestStatusTag = ({
  status,
  testedAt
}: {
  status: AiTestStatus | null;
  testedAt: string | null;
}) => {
  const { t, i18n } = useTranslation();

  const label = status
    ? t(`credentials.status.${status}`)
    : t("credentials.status.untested");

  const relative =
    testedAt === null
      ? null
      : new Intl.RelativeTimeFormat(i18n.language, { numeric: "auto" }).format(
          Math.round((new Date(testedAt).getTime() - Date.now()) / 60000),
          "minute"
        );

  const tag = <Tag color={status ? COLOR[status] : "default"}>{label}</Tag>;

  return relative === null ? (
    tag
  ) : (
    <span className="inline-flex items-center gap-2">
      {tag}
      <Tooltip title={new Date(testedAt as string).toLocaleString(i18n.language)}>
        <span className="text-xs text-slate-500 dark:text-slate-400">{relative}</span>
      </Tooltip>
    </span>
  );
};

export default TestStatusTag;
```

- [ ] **Step 3: Write the failing test for the modal**

`client/src/components/CredentialFormModal/__tests__/CredentialFormModal.test.tsx` — follow the existing `client/src/views/DocumentLibrary/__tests__/DocumentLibrary.test.tsx` setup (same render helper with a `QueryClientProvider` and i18n bootstrap). Assert:

```tsx
it("requires a label and a key of at least 20 characters when creating", async () => {
  renderModal({ credential: null });
  await userEvent.type(screen.getByLabelText(/name/i), "Mine");
  await userEvent.type(screen.getByLabelText(/api key/i), "x".repeat(19));
  await userEvent.click(screen.getByRole("button", { name: /save/i }));
  expect(await screen.findByText(/at least 20/i)).toBeInTheDocument();
  expect(createSpy).not.toHaveBeenCalled();
});

it("does not send apiKey when editing and the field is left blank", async () => {
  renderModal({ credential: existingCredential });
  await userEvent.clear(screen.getByLabelText(/name/i));
  await userEvent.type(screen.getByLabelText(/name/i), "Renamed");
  await userEvent.click(screen.getByRole("button", { name: /save/i }));
  await waitFor(() => expect(updateSpy).toHaveBeenCalled());
  expect(updateSpy.mock.calls[0][0].input).not.toHaveProperty("apiKey");
});

it("shows chat and embeddings results separately after saving", async () => {
  testSpy.mockResolvedValue({ status: "model_unavailable", chat: "ok", embed: "model_unavailable", testedAt: NOW });
  renderModal({ credential: null });
  await fillValidForm();
  await userEvent.click(screen.getByRole("button", { name: /save/i }));
  expect(await screen.findByText(/chat/i)).toBeInTheDocument();
  expect(await screen.findByText(/model unavailable/i)).toBeInTheDocument();
});

it("shows the provider default as the model placeholder", async () => {
  renderModal({ credential: null });
  expect(screen.getByLabelText(/chat model/i)).toHaveAttribute(
    "placeholder",
    "openai/gpt-4o-mini"
  );
});
```

Run: `yarn test CredentialFormModal` → FAIL (module not found).

- [ ] **Step 4: Write the modal**

Build it with antd `Form` (`Form.useForm`), `Select` for provider, `Input` for label, `Input.Password` for the key, and two `Input`s for the models whose `placeholder` comes from `useProviders()` keyed by the currently selected provider. Rules:

- `label`: `required`, `max: 60`, trimmed via `getValueFromEvent`.
- `apiKey`: `required` **only when `credential === null`**; `min: 20`, `max: 400`; a `pattern: /^\S+$/` rule.
- `chatModel` / `embedModel`: `max: 120`, `pattern: /^\S+$/`, not required.
- Provider `Select` is disabled when editing (provider is immutable — see Task 4 Step 1).
- On submit: call `useCreateCredential()` or `useUpdateCredential()`; when the mutation resolves and either the key or a model changed, immediately call `useTestCredential()` and render the returned `chat` / `embed` statuses inline in the footer area before the user closes the dialog. Keep the dialog open until the test settles.
- On a `409` (`ApiError.status === 409`), set the field error on `label` to `t("credentials.errors.labelTaken")` rather than a toast.
- `okButtonProps={{ loading: isPending }}` so a double click cannot submit twice.
- Call `onSaved(credential)` with the saved DTO so the wizard can auto-select it.

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn test CredentialFormModal`
Expected: PASS.

- [ ] **Step 6: Quality gate + commit**

```bash
yarn format && yarn lint && yarn type-check && yarn test && yarn build
git add src
git commit -m "feat(client): shared credential form modal and status tag"
```

---

### Task 9: `/ai-credentials` page

**Files:**
- Create: `client/src/routes/_app/ai-credentials.tsx`
- Create: `client/src/views/AiCredentials/index.tsx`
- Create: `client/src/views/AiCredentials/mains/CredentialList/index.tsx`
- Create: `client/src/views/AiCredentials/components/CredentialRow/index.tsx`
- Create: `client/src/views/AiCredentials/__tests__/AiCredentials.test.tsx`
- Modify: `client/src/views/AppShell/components/Sidebar/index.tsx`
- Modify: `client/src/locales/en/translation.json`, `client/src/locales/vi/translation.json` (`nav.aiCredentials`)

**Interfaces:**
- Consumes: Tasks 7 and 8.
- Produces: route `/ai-credentials`.

- [ ] **Step 1: Write the failing test**

`client/src/views/AiCredentials/__tests__/AiCredentials.test.tsx`, following the `DocumentLibrary.test.tsx` harness:

```tsx
it("shows the empty state and says matching runs on the system key", async () => {
  mockCredentials([]);
  renderPage();
  expect(await screen.findByText(/no credentials yet/i)).toBeInTheDocument();
  expect(screen.getByText(/system key/i)).toBeInTheDocument();
});

it("renders human labels, a masked key and the default-model wording", async () => {
  mockCredentials([
    { ...base, provider: "gemini", keyLast4: "5821", chatModel: null, embedModel: null }
  ]);
  renderPage();
  expect(await screen.findByText("Google Gemini")).toBeInTheDocument();
  expect(screen.getByText(/••••5821/)).toBeInTheDocument();
  expect(screen.getAllByText(/default/i).length).toBeGreaterThan(0);
  expect(screen.queryByText("gemini")).not.toBeInTheDocument();
});

it("renders an error state when the list request fails", async () => {
  mockCredentialsError(500);
  renderPage();
  expect(await screen.findByRole("alert")).toHaveTextContent(/could not load/i);
});

it("explains the 503 when credential storage is unconfigured", async () => {
  mockCredentialsError(503);
  renderPage();
  expect(await screen.findByRole("alert")).toHaveTextContent(/not configured/i);
});
```

Run: `yarn test AiCredentials` → FAIL.

- [ ] **Step 2: Write the row**

`CredentialRow/index.tsx` — presentational `<li>` mirroring `DocumentRow`'s classes: provider badge (`Tag`), label as the row title, `••••{keyLast4}` in a mono span, a muted line with `chatModel ?? t("credentials.defaultModel")` and the same for embed, `<TestStatusTag />`, then three antd `Button`s (Test / Edit / Delete) in that tab order. Delete is wrapped in antd `Popconfirm` with `title={t("credentials.delete.confirm")}` and `description={t("credentials.delete.hint")}`. Props: `{ credential, testing, deleting, onTest, onEdit, onDelete }`.

- [ ] **Step 3: Write the list organism**

`CredentialList/index.tsx` — same skeleton/error/empty/list structure as `DocumentList`: `useAiCredentials()`, `message.useMessage()` for toasts, `useTestCredential()` and `useDeleteCredential()`, local state for `editTarget: AiCredentialDto | null` and `addOpen: boolean`, rendering `<CredentialFormModal />`. Error branch distinguishes `ApiError.status === 503` (`credentials.errors.notConfigured`) from anything else (`credentials.errors.loadFailed`). Below the list, render the muted info panel using `credentials.emptyHint` wording about the system-key fallback.

- [ ] **Step 4: Write the view shell and route**

`views/AiCredentials/index.tsx`:

```tsx
import CredentialList from "./mains/CredentialList";

/**
 * AI credentials page — manage the user's own provider keys.
 * Mock: docs/ui-designs/ai-credentials/credentials-page.html.
 */
const AiCredentials = () => <CredentialList />;

export default AiCredentials;
```

`routes/_app/ai-credentials.tsx`:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import AiCredentials from "#/views/AiCredentials";

export const Route = createFileRoute("/_app/ai-credentials")({
  component: AiCredentials
});
```

Run `yarn generate-routes` to refresh `routeTree.gen.ts` (never hand-edit it).

- [ ] **Step 5: Add the sidebar entry**

In `Sidebar/index.tsx`, import `KeyRound` from `lucide-react` and append to `NAV_ITEMS`:

```ts
  { to: "/ai-credentials", icon: KeyRound, labelKey: "nav.aiCredentials" }
```

Add `"aiCredentials": "AI credentials"` to `nav` in `en`, and the Vietnamese equivalent in `vi`.

- [ ] **Step 6: Run tests + quality gate + commit**

```bash
yarn test AiCredentials
yarn format && yarn lint && yarn type-check && yarn test && yarn build
git add src
git commit -m "feat(client): AI credentials management page"
```

---

### Task 10: Wizard step 3 selector and step 4 attribution

**Files:**
- Create: `client/src/views/Wizard/components/RunWithSelector/index.tsx`
- Create: `client/src/views/Wizard/components/RunWithSelector/__tests__/RunWithSelector.test.tsx`
- Modify: `client/src/stores/slices/wizard.ts`
- Modify: `client/src/views/Wizard/mains/StepReview/index.tsx`
- Modify: `client/src/views/Wizard/mains/StepResult/index.tsx`

**Interfaces:**
- Consumes: Tasks 7 and 8; `MatchResultDto.provider` / `.chatModel` from Task 5.
- Produces: `<RunWithSelector value={string | null} onChange={(id: string | null) => void} />`; `useWizardStore` gains `credentialId: string | null` and `setCredentialId(id: string | null)`.

- [ ] **Step 1: Extend the store**

In `client/src/stores/slices/wizard.ts` add `credentialId: string | null` to `WizardState` and `initialState` (as `null`), plus `setCredentialId: (id: string | null) => void` implemented as `set({ credentialId: id })`. `reset()` already spreads `initialState`, so it clears automatically.

- [ ] **Step 2: Write the failing test**

`RunWithSelector/__tests__/RunWithSelector.test.tsx`:

```tsx
it("defaults to the most recently used credential", async () => {
  mockCredentials([
    { ...base, id: "a", label: "Older", lastUsedAt: "2026-08-01T00:00:00Z" },
    { ...base, id: "b", label: "Newer", lastUsedAt: "2026-08-05T00:00:00Z" }
  ]);
  const onChange = vi.fn();
  render(<RunWithSelector value={null} onChange={onChange} />);
  await waitFor(() => expect(onChange).toHaveBeenCalledWith("b"));
});

it("defaults to the system key when the user has no credentials", async () => {
  mockCredentials([]);
  const onChange = vi.fn();
  render(<RunWithSelector value={null} onChange={onChange} />);
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
  expect(screen.getByText(/system key/i)).toBeInTheDocument();
});

it("warns without blocking when the selected credential is untested", async () => {
  mockCredentials([{ ...base, id: "a", lastTestStatus: null }]);
  render(<RunWithSelector value="a" onChange={vi.fn()} />);
  expect(await screen.findByText(/has not been tested/i)).toBeInTheDocument();
});

it("names the provider the documents will be sent to", async () => {
  mockCredentials([{ ...base, id: "a", provider: "gemini" }]);
  render(<RunWithSelector value="a" onChange={vi.fn()} />);
  expect(await screen.findByText(/sent to Google Gemini/i)).toBeInTheDocument();
});

it("falls back to the system key when the selected credential disappears", async () => {
  mockCredentials([]);
  const onChange = vi.fn();
  render(<RunWithSelector value="deleted-id" onChange={onChange} />);
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(null));
});
```

Run: `yarn test RunWithSelector` → FAIL.

- [ ] **Step 3: Write the component**

An antd `Select` (with an `aria-label` from `credentials.runWith.title`) whose options are the credentials plus a final `System key` option with `value={SYSTEM_KEY_VALUE}` (use the literal string `"__system__"` internally and map it to `null` at the boundary, because antd `Select` treats `null`/`undefined` as "no selection"). Each credential option renders provider badge, label, `••••{keyLast4}` and a coloured dot. Beside it, a secondary `Button` `+ {t("credentials.add")}` opening `<CredentialFormModal />`; `onSaved` calls `onChange(saved.id)`.

An effect picks the default exactly once per list load: if `value` is not among the loaded ids, call `onChange` with the id of the credential having the newest non-null `lastUsedAt`, or `null` when the list is empty. Below the select, render the untested/failed warning (amber, with a `Test now` link calling `useTestCredential()`) and the privacy notice using `credentials.runWith.privacy` with the provider display name interpolated, or `privacySystem` when the system key is selected.

- [ ] **Step 4: Wire into `StepReview`**

Read `credentialId` and `setCredentialId` from `useWizardStore`, render `<RunWithSelector value={credentialId} onChange={setCredentialId} />` in a bordered block directly above the footer, and pass `credentialId: credentialId ?? undefined` into `runMatch.mutateAsync`.

- [ ] **Step 5: Show attribution in `StepResult`**

Under the score header, render a muted line: the provider display name from `useProviders()` matched on `result.provider`, then `·`, then `result.chatModel`.

- [ ] **Step 6: Run tests + quality gate + commit**

```bash
yarn test
yarn format && yarn lint && yarn type-check && yarn test && yarn build
git add src
git commit -m "feat(wizard): choose a credential in step 3 and show it in the result"
```

---

### Task 11: Playwright E2E suite

**Files:**
- Create: `client/e2e/ai-credentials/helpers.ts`
- Create: `client/e2e/ai-credentials/happy-path.e2e.ts`
- Create: `client/e2e/ai-credentials/validation.e2e.ts`
- Create: `client/e2e/ai-credentials/data-and-empty.e2e.ts`
- Create: `client/e2e/ai-credentials/i18n.e2e.ts`
- Create: `client/e2e/ai-credentials/error-and-loading.e2e.ts`
- Create: `client/e2e/ai-credentials/mutation-and-state.e2e.ts`
- Create: `client/e2e/ai-credentials/accessibility.e2e.ts`
- Create: `docs/specs/ai-credentials/e2e.md`

**Interfaces:**
- Consumes: the running app (server `:5200`, client `:5300`).
- Produces: nothing consumed by later tasks.

Every ✅ row of the design's E2E Scenario Matrix gets a test. `helpers.ts` provides `createCredentialViaApi()`, `deleteAllCredentials()` (called in `afterAll` of every file), and `stubProviderCalls(page, verdict)` which uses `page.route("**/ai-credentials/*/test", …)` so **no real provider call is ever made**.

- [ ] **Step 1: Write `helpers.ts` and the happy-path file (matrix row 1)**

Cover: empty page → empty state + Add button; create a credential → row shows `••••` + last four and an auto-run test; Test on an existing row updates the tag; wizard step 3 defaults to the newest-used credential and step 4 shows `Run with: OpenRouter · openai/gpt-4o-mini`.

- [ ] **Step 2: Validation and boundary (rows 4 and 6)**

`[EP]` apiKey classes: valid / empty / 19 chars / contains a space / whitespace only. `label`: valid / empty / duplicate. `[DT]` combinations: duplicate label + valid key → 409 surfaced on the label field; valid label + 19-char key → blocked client-side with **zero** requests (assert via `page.on("request")` counting calls to `/ai-credentials`); duplicate label + 19-char key → the client-side key error wins and no request is sent. `[BVA]` apiKey `19|20|400|401`, label `0|1|60|61`.

- [ ] **Step 3: Empty/null and data rendering (rows 5 and 8)**

Null `chatModel`/`embedModel` → the word "Default"; null `lastTestStatus` → "Not tested"; null timestamps → `—` and never `Invalid Date`; provider renders as "Google Gemini" not `gemini`; status renders as "Invalid key" not `invalid_key`; and `expect(await page.content()).not.toContain(FULL_KEY)`.

- [ ] **Step 4: i18n (row 9)**

Run the page and the step-3 block in `en` and `vi`; assert no raw i18n key (`/credentials\./`) is visible anywhere in the rendered text in either locale.

- [ ] **Step 5: Error and loading (row 10)**

`page.route` the list endpoint to 500 → error alert; to 503 → the "not configured" message; the test endpoint to `invalid_key` → red tag and no crash; delete the selected credential then Run match → the 404 is surfaced and no result page is shown.

- [ ] **Step 6: Mutation safety and state transitions (row 11)**

`[ST]` create (untested) → test → ok → rotate the key → the tag must return to "Not tested" → delete. Invalid transition: select a credential in step 3, delete it from the credentials page, return and Run match → error, no match created. Double-submit: click Save twice quickly → exactly one credential exists afterwards.

- [ ] **Step 7: Accessibility (row 12)**

Modal focus lands on the first field, `Escape` closes it and focus returns to the trigger; every field is reachable via `getByLabel`; the `Popconfirm` is operable by keyboard; the Run-with `Select` has an accessible name; row tab order is Test → Edit → Delete.

- [ ] **Step 8: Write `docs/specs/ai-credentials/e2e.md`**

Copy the matrix from `design.md` and add, per scenario, the file and test name that implements it, plus the gate (`A+B` / `A only`).

- [ ] **Step 9: Run gate A**

With both dev servers running (server `:5200`, client `:5300`):

Run: `yarn test:e2e --project=desktop -g "ai-credentials"`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add e2e
git commit -m "test(ai-credentials): playwright suite covering the scenario matrix"
```

---

## Self-Review

**Spec coverage.** design.md §4.1 → Tasks 1, 3, 4; §4.2 → Task 3; §4.3 → Task 1; §4.4 → Task 2; §4.5 → Tasks 4, 5, 7; §4.6 → Tasks 3, 4; §4.7 → Task 5; §5 invariants → Task 1 (crypto), Task 4 (DTO/throttle/409/validation), Task 6 (leak + ownership e2e), Task 8 (masked display); §6 FE structure → Tasks 7–10; §7 matrix → Task 11; §8 testing → embedded in each task; §9 non-code changes → Task 1 (`.env.example`) plus the flow's step 4.6 drift audit for `erd.md` and `project-goals.md`.

**Type consistency.** `AiRuntimeConfig` is defined once in Task 3 and consumed with the same five fields in Tasks 4 and 5. `worstStatus` / `mapProviderError` are exported from `ai.service.ts` in Task 3 and imported in Task 4. `AiCredentialDto` field names match between the BE DTO (Task 4) and the FE type (Task 7). `useTestCredential` returns `TestResultDto` in both Task 7 and Task 8. `SYSTEM_KEY_VALUE` is local to Task 10 and never crosses a boundary — the API contract uses `credentialId?: string` with the field absent meaning "system key".

**Resolved during planning.** An earlier draft of `design.md` §4.7 wrapped the result write and the `lastUsedAt` stamp in one `$transaction`. That would roll back a successfully computed — and already paid for — match just because an audit timestamp failed, so the stamp now sits outside the write. `design.md` was corrected to match; the two documents agree.
