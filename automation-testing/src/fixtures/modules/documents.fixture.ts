import { readFileSync } from "node:fs";
import type { DocumentDto, DocumentKind } from "#/types/Documents";
import type { ApiClient, FilePart } from "@/api";
import { docText, docTitle } from "@/data/test-data/documents";
import { FILES } from "@/data/test-data/shared";
import { LibraryPage } from "@/pages/documents/library.page";
import { insertDocument, insertMatchResult, insertMatchRun } from "@/utils/db";
import { createGuestUser, createSignedInUser, deleteUsers, SESSION_COOKIE } from "@/utils/sessions";
import { test as shared } from "../shared.fixture";

// Fixture slot of module "documents" — owned by that module: its page objects, seeded data, AI stubs.
// Fixture names must be unique across ALL modules (mergeTests merges them into one test): every name here starts
// with "doc".
//
//   docOwner        a fresh signed-in user per test (deleted afterwards, which cascades to its documents/matches),
//                   with an ApiClient bound to it and seeding helpers. Using a fresh user instead of the shared e2e
//                   user makes counts, order and the empty state exact even when other modules left rows behind.
//   docStranger     a second signed-in user who owns one CV (a PDF with its original file): the isolation target.
//   docLibraryPage  LibraryPage on the test's page, the browser signed in as docOwner (its mcv_session cookie replaces
//                   the e2e user's from storageState). Gate specs call docSignInAs(undefined | "guest") first.

export interface DocOwner {
  userId: string;
  cookie: string;
  api: ApiClient;
  /** POST /documents (JSON). Defaults: save=true, a unique title, a unique CV/JD text. Throws unless 201. */
  paste(
    kind: DocumentKind,
    opts?: { save?: boolean; title?: string; text?: string }
  ): Promise<DocumentDto>;
  /** POST /documents (multipart). Throws unless 201. */
  upload(
    kind: DocumentKind,
    file: string | FilePart,
    opts?: { save?: boolean; title?: string }
  ): Promise<DocumentDto>;
  /** Insert a Document row directly (bytes the server never parses, e.g. a multi-page PDF). Returns its id. */
  insert(input: {
    kind: DocumentKind;
    title: string;
    rawText: string;
    sourceFormat?: "pdf" | "docx" | "text";
    fileData?: Buffer | null;
    fileMime?: string | null;
    isSaved?: boolean;
    parentId?: string | null;
  }): Promise<string>;
  /** A succeeded MatchResult referencing both documents (what makes DELETE answer 409). */
  referenceInMatch(cvDocumentId: string, jdDocumentId: string): Promise<string>;
  /** A MatchRun with no result yet (a run opened then abandoned). */
  openRun(cvDocumentId: string, jdDocumentId: string): Promise<string>;
}

export interface DocStranger {
  userId: string;
  cookie: string;
  docId: string;
  title: string;
}

/** How the browser tab is signed in: as docOwner (default), anonymous (no cookie), or as a fresh guest. */
export type DocSignIn = (who: "owner" | "anonymous" | "guest") => Promise<void>;

function expect201(res: { status: number; body: unknown }, what: string): DocumentDto {
  if (res.status !== 201) throw new Error(`${what}: expected 201, got ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as DocumentDto;
}

export const test = shared.extend<{
  docOwner: DocOwner;
  docStranger: DocStranger;
  docSignInAs: DocSignIn;
  docLibraryPage: LibraryPage;
}>({
  docOwner: async ({ apiAs }, use) => {
    const user = await createSignedInUser();
    const api = apiAs(user);
    const owner: DocOwner = {
      ...user,
      api,
      paste: async (kind, opts = {}) =>
        expect201(
          await api.documents.create({
            kind,
            save: opts.save ?? true,
            title: opts.title ?? (opts.save === false ? undefined : docTitle(kind)),
            sourceText: opts.text ?? docText(kind),
          }),
          "docOwner.paste"
        ),
      upload: async (kind, file, opts = {}) =>
        expect201(
          await api.documents.upload({
            kind,
            save: opts.save ?? true,
            title: opts.title ?? (opts.save === false ? undefined : docTitle(kind)),
            file,
          }),
          "docOwner.upload"
        ),
      insert: (input) => insertDocument({ userId: user.userId, isSaved: true, ...input }),
      referenceInMatch: (cvDocumentId, jdDocumentId) =>
        insertMatchResult({ userId: user.userId, cvDocumentId, jdDocumentId, scores: [80, 80, 80] }),
      openRun: (cvDocumentId, jdDocumentId) => insertMatchRun({ userId: user.userId, cvDocumentId, jdDocumentId }),
    };
    await use(owner);
    await deleteUsers([user.userId]);
  },

  docStranger: async ({}, use) => {
    const user = await createSignedInUser();
    const title = docTitle("Stranger CV");
    const docId = await insertDocument({
      userId: user.userId,
      kind: "CV",
      title,
      sourceFormat: "pdf",
      rawText: "stranger private content",
      isSaved: true,
      fileData: readFileSync(FILES.pdf),
      fileMime: "application/pdf",
    });
    await use({ ...user, docId, title });
    await deleteUsers([user.userId]);
  },

  docSignInAs: async ({ page, docOwner, urls }, use) => {
    const extra: string[] = [];
    const host = new URL(urls.webUrl).hostname;
    const plant = async (cookie: string) => {
      const value = cookie.slice(`${SESSION_COOKIE}=`.length);
      await page.context().addCookies([{ name: SESSION_COOKIE, value, domain: host, path: "/", httpOnly: true, sameSite: "Lax" }]);
    };
    await plant(docOwner.cookie);
    await use(async (who) => {
      await page.context().clearCookies();
      if (who === "owner") await plant(docOwner.cookie);
      if (who === "guest") {
        const guest = await createGuestUser();
        extra.push(guest.userId);
        await plant(guest.cookie);
      }
    });
    await deleteUsers(extra);
  },

  docLibraryPage: async ({ page, docSignInAs }, use) => {
    void docSignInAs; // signs the tab in as docOwner before the page object is used
    await use(new LibraryPage(page));
  },
});
