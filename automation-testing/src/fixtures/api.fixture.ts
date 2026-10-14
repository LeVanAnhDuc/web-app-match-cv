import { createApiClient, type ApiClient, type Identity } from "@/api";
import { sessionCookieHeader } from "@/utils/auth-state";
import { test as http } from "./http.fixture";

// Typed REST clients (src/api/index.ts) on top of the worker `http` factory. All worker-scoped, so `beforeAll` can
// seed through them too. Nothing to dispose: every call opens and closes its own request context.
//   api          signed in as the seeded e2e user (.auth/user.json). The cookie is read on the first REQUEST, not
//                when the fixture is built, so the file only has to exist once a test actually calls the API.
//   anonApi      no cookie at all
//   apiAs(id)    any other caller: "mcv_session=…", [cookie, cookie], a SeededUser ({ cookie }) or () => string
export const test = http.extend<{}, { api: ApiClient; anonApi: ApiClient; apiAs: (identity: Identity) => ApiClient }>({
  api: [async ({ http }, use) => use(createApiClient(http, () => sessionCookieHeader().Cookie)), { scope: "worker" }],
  anonApi: [async ({ http }, use) => use(createApiClient(http)), { scope: "worker" }],
  apiAs: [async ({ http }, use) => use((identity: Identity) => createApiClient(http, identity)), { scope: "worker" }],
});
