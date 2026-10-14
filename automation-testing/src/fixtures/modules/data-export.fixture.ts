import { randomUUID } from "node:crypto";
import type { BrowserContext, Page, Route } from "@playwright/test";
import AdmZip from "adm-zip";
import { AUTH_ME_URL_GLOB, EXPORT_URL_GLOB } from "@/data/test-data/data-export";
import { MyDataPage } from "@/pages/data-export/my-data.page";
import { readE2eUserId } from "@/utils/auth-state";
import {
  insertCoverLetter,
  insertMatchResult,
  insertMatchRun,
  sql,
  utc,
  type MatchReport,
} from "@/utils/db";
import {
  createGuestUser,
  createSignedInUser,
  createUser,
  deleteUsers,
  type SeededUser,
} from "@/utils/sessions";
import { test as shared } from "../shared.fixture";

// Fixture slot of module "data-export" (GET /me/export, /my-data). Every name is prefixed (dataExport…) or specific
// (myDataPage) because all module slots merge into one `test`.
//   myDataPage          MyDataPage on the test's page (signed in as the seeded e2e user in the app* projects)
//   dataExportUsers     throwaway signed-in / guest / bare users, deleted (cascade) after the test
//   dataExportSeed      rows the export reads, inserted straight into the dev DB (fixed createdAt, bulk documents)
//   dataExportArchive   opens a zip body: entry names, bytes, data.json, UTF-8 flag
//   dataExportVisitor   a second browser context as an anonymous visitor or a guest (same viewport as the project)
//   dataExportNetwork   slow the REAL /me/export response, hold /auth/me until released
//   dataExportE2eUserId id of the seeded e2e user the UI runs as

// ── archive ────────────────────────────────────────────────────────────────
export interface ExportManifest {
  schemaVersion: number;
  exportedAt: string;
  user: Record<string, unknown> & { id: string; role: string; createdAt: string };
  documents: Array<Record<string, unknown> & { id: string; title: string; file: string | null; rawText: string }>;
  matchResults: Array<Record<string, unknown> & { id: string; credentialId: unknown }>;
  aiCredentials: Array<Record<string, unknown> & { id: string; keyLast4: string }>;
  [key: string]: unknown;
}

export interface ExportArchive {
  /** Every entry name, in archive order. */
  names: string[];
  /** Entries under documents/. */
  documentEntries: string[];
  has(name: string): boolean;
  /** Decompressed bytes of one entry. */
  bytes(name: string): Buffer;
  /** data.json parsed. */
  manifest(): ExportManifest;
  /** Every entry's decompressed content as latin1 text, joined (for substring leak scans). */
  decompressedText(): string;
  /** General-purpose flag bit 11 (UTF-8 names) of an entry. */
  utf8Flag(name: string): boolean;
}

function openArchive(raw: Buffer): ExportArchive {
  const zip = new AdmZip(raw);
  const entries = zip.getEntries();
  const names = entries.map((e) => e.entryName);
  const entry = (name: string) => {
    const found = zip.getEntry(name);
    if (!found) throw new Error(`export archive has no entry "${name}" (has: ${names.join(", ")})`);
    return found;
  };
  return {
    names,
    documentEntries: names.filter((n) => n.startsWith("documents/")),
    has: (name) => names.includes(name),
    bytes: (name) => entry(name).getData(),
    manifest: () => JSON.parse(entry("data.json").getData().toString("utf8")) as ExportManifest,
    decompressedText: () => entries.map((e) => e.getData().toString("latin1")).join("\n"),
    utf8Flag: (name) => (entry(name).header.flags & 0x800) !== 0,
  };
}

// ── users ──────────────────────────────────────────────────────────────────
export interface DataExportUsers {
  signedIn(opts?: { email?: string }): Promise<SeededUser>;
  guest(): Promise<SeededUser>;
  /** A user row with no session ("another user" whose data must never show up). */
  bare(): Promise<string>;
  /** Delete a user now (its sessions go with it). */
  remove(userId: string): Promise<void>;
}

// ── seed ───────────────────────────────────────────────────────────────────
export interface SeedDocument {
  userId: string;
  title: string;
  kind?: "CV" | "JD";
  sourceFormat?: "pdf" | "docx" | "text";
  rawText?: string;
  fileData?: Buffer | null;
  fileMime?: string | null;
  isSaved?: boolean;
  parentId?: string | null;
  createdAt?: Date;
}

export interface SeedCredential {
  userId: string;
  provider?: "openrouter" | "openai" | "gemini";
  label?: string;
  encryptedKey?: Buffer;
  keyIv?: Buffer;
  keyTag?: Buffer;
  keyLast4?: string;
  createdAt?: Date;
}

export interface DataExportSeed {
  document(input: SeedDocument): Promise<string>;
  /** `count` documents with the same file bytes, in one statement. Returns nothing: read ids back from the export. */
  bulkDocuments(userId: string, count: number, fileData: Buffer, mime?: string): Promise<void>;
  credential(input: SeedCredential): Promise<string>;
  matchResult(input: {
    userId: string;
    cvDocumentId: string;
    jdDocumentId: string;
    credentialId?: string | null;
    runId?: string | null;
    report?: MatchReport;
    createdAt?: Date;
  }): Promise<string>;
  matchRun(input: { userId: string; cvDocumentId: string; jdDocumentId: string }): Promise<string>;
  coverLetter(input: { userId: string; matchResultId: string; content?: string }): Promise<string>;
  /** A CV + a JD pair (paste text, no file) to hang matches on. */
  pair(userId: string): Promise<{ cvId: string; jdId: string }>;
}

const seed: DataExportSeed = {
  async document(input) {
    const id = randomUUID();
    await sql(
      `INSERT INTO "Document"
         (id, "userId", kind, title, "sourceFormat", "rawText", "fileData", "fileMime", "isSaved", "parentId", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz AT TIME ZONE 'UTC')`,
      [
        id,
        input.userId,
        input.kind ?? "CV",
        input.title,
        input.sourceFormat ?? (input.fileData ? "pdf" : "text"),
        input.rawText ?? "seeded text",
        input.fileData ?? null,
        input.fileMime ?? null,
        input.isSaved ?? true,
        input.parentId ?? null,
        utc(input.createdAt),
      ]
    );
    return id;
  },
  async bulkDocuments(userId, count, fileData, mime = "application/pdf") {
    await sql(
      `INSERT INTO "Document"
         (id, "userId", kind, title, "sourceFormat", "rawText", "fileData", "fileMime", "isSaved", "createdAt")
       SELECT gen_random_uuid()::text, $1::text, 'CV'::"DocumentKind", 'Bulk CV ' || g, 'pdf'::"SourceFormat",
              'bulk ' || g, $2::bytea, $3::text, true,
              ($4::timestamptz AT TIME ZONE 'UTC') + (g * interval '1 millisecond')
         FROM generate_series(1, $5::int) AS g`,
      [userId, fileData, mime, utc(), count]
    );
  },
  async credential(input) {
    const id = randomUUID();
    const at = utc(input.createdAt);
    await sql(
      `INSERT INTO "AiCredential"
         (id, "userId", provider, label, "encryptedKey", "keyIv", "keyTag", "keyLast4", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::timestamptz AT TIME ZONE 'UTC', $9::timestamptz AT TIME ZONE 'UTC')`,
      [
        id,
        input.userId,
        input.provider ?? "openai",
        input.label ?? "Key ca nhan",
        input.encryptedKey ?? Buffer.from("ciphertext"),
        input.keyIv ?? Buffer.from("iv"),
        input.keyTag ?? Buffer.from("tag"),
        input.keyLast4 ?? "4f2a",
        at,
      ]
    );
    return id;
  },
  matchResult: (input) =>
    insertMatchResult({
      userId: input.userId,
      cvDocumentId: input.cvDocumentId,
      jdDocumentId: input.jdDocumentId,
      credentialId: input.credentialId ?? null,
      runId: input.runId ?? null,
      report: input.report,
      scores: [72, 80, 60],
      createdAt: input.createdAt,
    }),
  matchRun: (input) => insertMatchRun(input),
  coverLetter: (input) =>
    insertCoverLetter({ userId: input.userId, matchResultId: input.matchResultId, content: input.content }),
  async pair(userId) {
    const cvId = await seed.document({ userId, kind: "CV", title: "Seed CV", rawText: "TypeScript, NestJS" });
    const jdId = await seed.document({ userId, kind: "JD", title: "Seed JD", rawText: "Backend engineer, NestJS" });
    return { cvId, jdId };
  },
};

// ── visitors (second browser context) ──────────────────────────────────────
export interface DataExportVisitor {
  context: BrowserContext;
  page: Page;
  myDataPage: MyDataPage;
  /** URLs of every /me/export request this tab sent. */
  exportRequests: string[];
}

// ── network ────────────────────────────────────────────────────────────────
export interface DataExportNetwork {
  /** Let GET /me/export reach the real backend, but hand the response to the page only after `ms`. */
  slowExport(page: Page, ms: number): Promise<void>;
  /** Hold GET /auth/me until `release()` is called; then it goes to the real backend. */
  holdAuthMe(page: Page): Promise<{ release(): void }>;
}



const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const test = shared.extend<{
  myDataPage: MyDataPage;
  dataExportUsers: DataExportUsers;
  dataExportSeed: DataExportSeed;
  dataExportArchive: (raw: Buffer) => ExportArchive;
  dataExportVisitor: (who: "anonymous" | "guest") => Promise<DataExportVisitor>;
  dataExportNetwork: DataExportNetwork;
  dataExportE2eUserId: string;
}>({
  myDataPage: async ({ page }, use) => use(new MyDataPage(page)),

  dataExportUsers: async ({}, use) => {
    const created: string[] = [];
    await use({
      async signedIn(opts) {
        const user = await createSignedInUser(opts);
        created.push(user.userId);
        return user;
      },
      async guest() {
        const user = await createGuestUser();
        created.push(user.userId);
        return user;
      },
      async bare() {
        const id = await createUser();
        created.push(id);
        return id;
      },
      remove: (userId) => deleteUsers([userId]),
    });
    await deleteUsers(created);
  },

  dataExportSeed: async ({}, use) => use(seed),

  dataExportArchive: async ({}, use) => use(openArchive),

  dataExportVisitor: async ({ browser }, use, testInfo) => {
    const contexts: BrowserContext[] = [];
    const guests: string[] = [];
    await use(async (who) => {
      const project = testInfo.project.use;
      const baseURL = project.baseURL;
      const context = await browser.newContext({
        baseURL,
        viewport: project.viewport,
        hasTouch: project.hasTouch,
        isMobile: project.isMobile,
        deviceScaleFactor: project.deviceScaleFactor,
        userAgent: project.userAgent,
        storageState: { cookies: [], origins: [] },
      });
      contexts.push(context);
      if (who === "guest") {
        const guest = await createGuestUser();
        guests.push(guest.userId);
        const split = guest.cookie.indexOf("=");
        await context.addCookies([
          {
            name: guest.cookie.slice(0, split),
            value: guest.cookie.slice(split + 1),
            domain: new URL(baseURL ?? "http://localhost").hostname,
            path: "/",
            httpOnly: true,
            sameSite: "Lax",
          },
        ]);
      }
      const page = await context.newPage();
      const exportRequests: string[] = [];
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.endsWith("/me/export")) exportRequests.push(request.url());
      });
      return { context, page, myDataPage: new MyDataPage(page), exportRequests };
    });
    for (const context of contexts) await context.close().catch(() => undefined);
    await deleteUsers(guests);
  },

  dataExportNetwork: async ({}, use) => {
    const routes: Array<{ page: Page; url: string; handler: (route: Route) => Promise<void> }> = [];
    const releases: Array<() => void> = [];
    await use({
      async slowExport(page, ms) {
        const handler = async (route: Route) => {
          if (route.request().method() !== "GET") return route.fallback();
          // The page may be gone by the time the slowed response is handed back (TC "leave mid-download").
          const response = await route.fetch().catch(() => undefined);
          if (!response) return;
          await sleep(ms);
          await route.fulfill({ response }).catch(() => undefined);
        };
        routes.push({ page, url: EXPORT_URL_GLOB, handler });
        await page.route(EXPORT_URL_GLOB, handler);
      },
      async holdAuthMe(page) {
        let release!: () => void;
        const released = new Promise<void>((resolve) => (release = resolve));
        const handler = async (route: Route) => {
          await released;
          await route.fallback().catch(() => undefined);
        };
        releases.push(release);
        routes.push({ page, url: AUTH_ME_URL_GLOB, handler });
        await page.route(AUTH_ME_URL_GLOB, handler);
        return { release };
      },
    });
    for (const release of releases) release();
    for (const { page, url, handler } of routes) await page.unroute(url, handler).catch(() => undefined);
  },

  dataExportE2eUserId: async ({}, use) => use(readE2eUserId()),
});
