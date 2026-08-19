---
name: standard-tanstack-start
description: >
  TanStack Start conventions for this project (TanStack Start on TanStack Router
  + Vite + React 19). Covers file-based routing in src/routes/, createFileRoute /
  createRootRouteWithContext, the __root shellComponent + HeadContent/Scripts,
  router context { queryClient }, route loaders vs React Query, import.meta.env
  (Vite), the generated routeTree.gen.ts, and SSR/isomorphic cautions.
  Use when writing or reviewing routes, the root document, data loaders, the
  router setup, or any SSR-sensitive client code.
user-invocable: false
---

# TanStack Start Standard (Vite + React 19)

> This project uses **TanStack Start** (full-stack React on TanStack Router + Vite), **not** Next.js. There is no App Router, no RSC, no `next/*` packages, no `middleware.ts`. Ignore any Next.js habit — routing, data, env, and SSR work differently here.

## 1. File-based Routing — `src/routes/`

Routes live in `src/routes/`. The filename maps to the URL path; TanStack Router's Vite plugin scans this folder.

- `src/routes/__root.tsx` → the root route (document shell, providers, devtools).
- `src/routes/index.tsx` → `/`.
- `src/routes/wizard.tsx` → `/wizard`.
- Nested folders / dotted names create nested paths (see TanStack Router docs for `$param`, layout, and pathless routes).

Every non-root route exports a `Route` created with `createFileRoute`:

```tsx
// src/routes/wizard.tsx
import { createFileRoute } from "@tanstack/react-router";
import { WizardPage } from "#/features/wizard/WizardPage";

export const Route = createFileRoute("/wizard")({ component: WizardPage });
```

Rules:

- The route file is thin — it wires the URL to a view/feature component. Keep page markup and logic in `src/views/**` (or the feature module), not inline in the route file.
- `export const Route = …` is a **named** export and is a framework contract — do not rename it or default-export it.
- The path string passed to `createFileRoute('/wizard')` must match the file location. If they drift, regenerate the route tree (see §5).

## 2. Root Route — `__root.tsx`

The root uses `createRootRouteWithContext<Ctx>()` and a `shellComponent` that renders the full HTML document:

```tsx
// src/routes/__root.tsx
import "@ant-design/v5-patch-for-react-19"; // MUST be first — see standard-antd
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext
} from "@tanstack/react-router";
import { AntdProvider } from "#/providers/AntdProvider";
import "#/i18n";
import appCss from "#/styles.css?url";
import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Match CV" }
    ],
    links: [{ rel: "stylesheet", href: appCss }]
  }),
  shellComponent: RootDocument
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AntdProvider>{children}</AntdProvider>
        <Scripts />
      </body>
    </html>
  );
}
```

Rules:

- `<HeadContent />` (in `<head>`) renders the `meta`/`links`/`title` collected from `head()` on the root and every matched route. Set document `<title>`/meta via a route's `head()` return, **never** by touching `document.title` imperatively.
- `<Scripts />` (end of `<body>`) injects the framework's hydration scripts. It is required — omitting it breaks hydration.
- Global CSS is imported as a URL (`import appCss from '#/styles.css?url'`) and linked via `head().links`. This is a Vite feature (`?url` suffix), not a Next.js pattern.
- Side-effect imports that must run once for the whole app (i18n init, the React-19 antd patch) go at the top of `__root.tsx`.
- Per-route metadata: give the route a `head()` that returns `{ meta, links }`; TanStack merges it with the root's.

## 3. Router setup + context

`src/router.tsx` builds the router and injects context (the shared `QueryClient`). Route loaders and components read this context.

```tsx
// src/router.tsx
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";
import { getContext } from "#/integrations/tanstack-query/root-provider";

export function getRouter() {
  const context = getContext(); // { queryClient }
  const router = createTanStackRouter({
    routeTree,
    context,
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0
  });
  setupRouterSsrQueryIntegration({ router, queryClient: context.queryClient });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
```

Rules:

- The `QueryClient` is created once in `getContext()` and shared through router context — never `new QueryClient()` inside a component.
- `defaultPreload: 'intent'` prefetches routes on hover/focus; `defaultPreloadStaleTime: 0` lets React Query own cache freshness (loaders don't double-cache).
- The `declare module` block registers the router type so `Link`, `useNavigate`, `useParams`, etc. are fully type-safe. Keep it.

## 4. Data fetching — loaders vs React Query

Two layers, used deliberately:

- **React Query (default for this project)** — server state lives in TanStack Query hooks colocated with the feature (e.g. `src/features/documents/queries.ts` → `useSavedDocuments`, `useCreateDocument`). All HTTP goes through the `apiFetch<T>` wrapper. This is the primary pattern; SSR hydration is handled by `setupRouterSsrQueryIntegration`.

```tsx
// feature query hook — the standard pattern
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "#/libs/api";

export function useSavedDocuments(kind: DocumentKind) {
  return useQuery({
    queryKey: ["documents", kind, "saved"] as const,
    queryFn: () =>
      apiFetch<Array<DocumentSummaryDto>>(`/documents?kind=${kind}&saved=true`)
  });
}
```

- **Route loaders** — use `loader` on a route only when data must be ready before the route renders (SSR-critical, blocking navigation). Prefer `context.queryClient.ensureQueryData(...)` inside the loader so the same cache is reused, rather than a parallel fetch:

```tsx
export const Route = createFileRoute("/documents/$id")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData({
      queryKey: ["documents", params.id],
      queryFn: () => apiFetch<DocumentDto>(`/documents/${params.id}`)
    }),
  component: DocumentPage
});
```

Rules:

- Never call raw `fetch` to the backend — always the `apiFetch<T>` wrapper in `src/libs/api.ts` (base `import.meta.env.VITE_API_BASE_URL`, throws `ApiError` on non-2xx). Responses are the DTO directly (no envelope/ResponsePattern).
- Don't duplicate a fetch in both a loader and a query hook — pick one, and if both are needed, share via `ensureQueryData`.
- Query defaults (staleTime, retries) belong on the shared `QueryClient` in `root-provider.tsx`, not scattered per-hook.

## 5. Generated route tree — `routeTree.gen.ts`

`src/routeTree.gen.ts` is **generated**. Never hand-edit it.

- Regenerate with `yarn generate-routes` (runs `tsr generate`). Config: `tsr.config.json`.
- The Vite dev server regenerates it automatically on route file changes; run the command manually before type-checking/building in CI or when the file looks stale.
- It is committed (imported by `router.tsx`), but treat every change to it as a build artifact — review it, don't author it.

## 6. Environment variables — Vite, not Next

- Client env is read via `import.meta.env`, **not** `process.env`. Example: `import.meta.env.VITE_API_BASE_URL`.
- Only variables prefixed `VITE_` are exposed to the browser bundle. Never put a secret in a `VITE_` var — it ships to the client (see `standard-security`).
- `import.meta.env.DEV` / `import.meta.env.PROD` gate dev-only code (e.g. the i18n `window.__i18n` test hook is behind `import.meta.env.DEV`).
- New env keys: add to `.env.example` (key + placeholder only, no secret) per §3.1 of the root CLAUDE.md.

## 7. SSR / isomorphic cautions

TanStack Start renders on the server first, then hydrates on the client. Code in components/loaders runs in **both** environments.

- Guard browser-only APIs. `window`, `document`, `localStorage`, `matchMedia` do not exist during SSR. Access them inside `useEffect` (client-only) or behind `typeof window !== 'undefined'`.

```tsx
// ✅ browser API inside an effect — only runs client-side
useEffect(() => {
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  // ...
}, []);

// ✅ one-time client-only setup guarded explicitly (see src/i18n/index.ts)
if (import.meta.env.DEV && typeof window !== "undefined") {
  (window as unknown as { __i18n: typeof i18n }).__i18n = i18n;
}
```

- **Hydration mismatch**: markup produced on the server must match the first client render. Do not branch initial render on `window`, `Date.now()`, or random values. For a value that legitimately differs (e.g. `prefers-color-scheme`), start from a stable default and update in `useEffect` after mount (see `AntdProvider`'s `usePrefersDark`).
- Use `useId()` for generated ids/ARIA — never `Math.random()`/`uuid` at render time.
- Do not create per-request singletons at module scope that hold user data — module scope is shared across SSR requests on the server.

## When writing TanStack Start code

- Keep route files thin; put UI + logic in `views/` / feature modules.
- Data goes through React Query + `apiFetch`; use loaders only for blocking/SSR-critical data via `ensureQueryData`.
- Read env from `import.meta.env` with the `VITE_` prefix; never `process.env`, never a secret in the client.
- Never hand-edit `routeTree.gen.ts`; run `yarn generate-routes`.
- Guard every `window`/`document` access for SSR; avoid hydration mismatches.
- `<HeadContent />` and `<Scripts />` stay in `__root.tsx`; the antd React-19 patch import stays first.
