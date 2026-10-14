import { createAiCredentialsClient } from "./ai-credentials.client";
import { createAuthClient } from "./auth.client";
import { createBaseClient, type BindOptions, type Identity } from "./base.client";
import { createComparisonsClient } from "./comparisons.client";
import { createCoverLettersClient } from "./cover-letters.client";
import { createCvRewriteClient } from "./cv-rewrite.client";
import { createDocsClient } from "./docs.client";
import { createDocumentsClient } from "./documents.client";
import type { HttpFactory } from "./http.client";
import { createHealthClient } from "./health.client";
import { createMatchClient } from "./match.client";
import { createMeClient } from "./me.client";

export type { ApiErrorBody, ApiResponse, BindOptions, FilePart, Identity, Lang, Loose } from "./base.client";
export { DOCX_MIME, PDF_MIME, filePart } from "./documents.client";

// Every namespace, bound to one identity. Match CV decides access per route (@Public / @AllowGuest / signed-in) on
// the SAME paths, so every namespace exists for every caller: an anonymous client is how a spec proves a 401.
function bind(factory: HttpFactory, identity: Identity, opts: BindOptions) {
  const base = createBaseClient(factory, identity, opts);
  return {
    /** Untyped escape hatch on the same identity: `raw.get("/anything")`. */
    raw: base.raw,
    /** The Cookie header this client sends (undefined = anonymous). */
    cookie: base.cookie,
    health: createHealthClient(base),
    docs: createDocsClient(base),
    auth: createAuthClient(base),
    documents: createDocumentsClient(base),
    match: createMatchClient(base),
    aiCredentials: createAiCredentialsClient(base),
    coverLetters: createCoverLettersClient(base),
    cvRewrite: createCvRewriteClient(base),
    comparisons: createComparisonsClient(base),
    me: createMeClient(base),
  };
}

export type BoundApi = ReturnType<typeof bind>;

export interface ApiClient extends BoundApi {
  /** Same namespaces as another caller: a cookie header, cookie list, SeededUser, or lazy getter. */
  as(identity: Identity, opts?: BindOptions): ApiClient;
  /** Same caller, server answering in `lng` (Accept-Language). */
  lang(lng: NonNullable<BindOptions["lang"]>): ApiClient;
}

/**
 * `factory` is `createHttp(request, apiUrl)` from ./http.client — pass another apiUrl to target a second server
 * instance (e.g. the auth module's Match CV pointed at the fake IdP).
 */
export function createApiClient(factory: HttpFactory, identity?: Identity, opts: BindOptions = {}): ApiClient {
  return {
    ...bind(factory, identity, opts),
    as: (next, nextOpts) => createApiClient(factory, next, { ...opts, ...(nextOpts ?? {}) }),
    lang: (lng) => createApiClient(factory, identity, { ...opts, lang: lng }),
  };
}
