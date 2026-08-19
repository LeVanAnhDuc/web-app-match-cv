---
name: standard-react
description: The single React standard for this project — project coding conventions (component structure, TypeScript, hooks, state, forms, a11y, hydration), performance patterns (waterfalls, bundle size, client data fetching, re-render/rendering/JS optimization, advanced patterns, mutations), and frontend performance ops (images/fonts, code-splitting via React.lazy + Vite dynamic import, video, CDN/caching, service workers, CI bundle gates, RUM monitoring, audit workflow) for a Vite / TanStack Start app. TRIGGER when writing or reviewing any React component/hook/page, async data fetching, dynamic imports, state/effect optimization, forms, or when auditing/optimizing frontend performance, bundle size, page speed, or Core Web Vitals in .tsx/.jsx files.
user-invocable: false
---

# React Best Practices

---

## 1. Eliminating Waterfalls

**Impact: CRITICAL**

Waterfalls are the #1 performance killer. Each sequential await adds full network latency. Eliminating them yields the largest gains.

### 1.1 Defer Await Until Needed

**Impact: HIGH (avoids blocking unused code paths)**

Move `await` operations into the branches where they're actually used to avoid blocking code paths that don't need them.

**Incorrect: blocks both branches**

```typescript
async function handleRequest(userId: string, skipProcessing: boolean) {
  const userData = await fetchUserData(userId);

  if (skipProcessing) {
    return { skipped: true };
  }

  return processUserData(userData);
}
```

**Correct: only blocks when needed**

```typescript
async function handleRequest(userId: string, skipProcessing: boolean) {
  if (skipProcessing) {
    return { skipped: true };
  }

  const userData = await fetchUserData(userId);
  return processUserData(userData);
}
```

**Another example: early return optimization**

```typescript
// Incorrect: always fetches permissions
async function updateResource(resourceId: string, userId: string) {
  const permissions = await fetchPermissions(userId);
  const resource = await getResource(resourceId);

  if (!resource) return { error: "Not found" };
  if (!permissions.canEdit) return { error: "Forbidden" };

  return await updateResourceData(resource, permissions);
}

// Correct: fetches only when needed
async function updateResource(resourceId: string, userId: string) {
  const resource = await getResource(resourceId);
  if (!resource) return { error: "Not found" };

  const permissions = await fetchPermissions(userId);
  if (!permissions.canEdit) return { error: "Forbidden" };

  return await updateResourceData(resource, permissions);
}
```

### 1.2 Dependency-Based Parallelization

**Impact: CRITICAL (2-10x improvement)**

For operations with partial dependencies, start promises early, await late.

**Incorrect: profile waits for config unnecessarily**

```typescript
const [user, config] = await Promise.all([fetchUser(), fetchConfig()]);
const profile = await fetchProfile(user.id);
```

**Correct: config and profile run in parallel**

```typescript
const userPromise = fetchUser();
const profilePromise = userPromise.then((user) => fetchProfile(user.id));

const [user, config, profile] = await Promise.all([
  userPromise,
  fetchConfig(),
  profilePromise
]);
```

### 1.3 Prevent Waterfall Chains in API Routes

**Impact: CRITICAL (2-10x improvement)**

Start independent operations immediately, even if you don't await them yet.

**Incorrect: config waits for auth, data waits for both**

```typescript
const session = await auth();
const config = await fetchConfig();
const data = await fetchData(session.user.id);
```

**Correct: auth and config start immediately**

```typescript
const sessionPromise = auth();
const configPromise = fetchConfig();
const session = await sessionPromise;
const [config, data] = await Promise.all([
  configPromise,
  fetchData(session.user.id)
]);
```

### 1.4 Promise.all() for Independent Operations

**Impact: CRITICAL (2-10x improvement)**

When async operations have no interdependencies, execute them concurrently.

```typescript
// Incorrect: sequential execution, 3 round trips
const user = await fetchUser();
const posts = await fetchPosts();
const comments = await fetchComments();

// Correct: parallel execution, 1 round trip
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
]);
```

### 1.5 Strategic Suspense Boundaries

**Impact: HIGH (faster initial paint)**

Use Suspense boundaries to show wrapper UI faster while data loads.

```tsx
// Incorrect: wrapper blocked by data fetching
async function Page() {
  const data = await fetchData(); // Blocks entire page
  return (
    <div>
      <Sidebar />
      <DataDisplay data={data} />
      <Footer />
    </div>
  );
}

// Correct: wrapper shows immediately, data streams in
function Page() {
  return (
    <div>
      <Sidebar />
      <Suspense fallback={<Skeleton />}>
        <DataDisplay />
      </Suspense>
      <Footer />
    </div>
  );
}
```

**Share promise across components:**

```tsx
function Page() {
  const dataPromise = fetchData();
  return (
    <Suspense fallback={<Skeleton />}>
      <DataDisplay dataPromise={dataPromise} />
      <DataSummary dataPromise={dataPromise} />
    </Suspense>
  );
}

function DataDisplay({ dataPromise }: { dataPromise: Promise<Data> }) {
  const data = use(dataPromise);
  return <div>{data.content}</div>;
}
```

---

## 2. Bundle Size Optimization

**Impact: CRITICAL**

Reducing initial bundle size improves Time to Interactive and Largest Contentful Paint.

### 2.1 Avoid Barrel File Imports

**Impact: CRITICAL (200-800ms import cost, slow builds)**

Import directly from source files instead of barrel files to avoid loading thousands of unused modules.

```tsx
// Incorrect: imports entire library
import { Check, X, Menu } from "lucide-react";
// Loads 1,583 modules, takes ~2.8s extra in dev

import { Button, TextField } from "@mui/material";
// Loads 2,225 modules, takes ~4.2s extra in dev

// Correct: direct imports
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
```

Libraries commonly affected: `lucide-react`, `@mui/material`, `@mui/icons-material`, `@tabler/icons-react`, `react-icons`, `@headlessui/react`, `@radix-ui/react-*`, `lodash`, `ramda`, `date-fns`, `rxjs`, `react-use`.

### 2.2 Conditional Module Loading

**Impact: HIGH (loads large data only when needed)**

```tsx
function AnimationPlayer({ enabled, setEnabled }: Props) {
  const [frames, setFrames] = useState<Frame[] | null>(null);

  useEffect(() => {
    if (enabled && !frames) {
      import("./animation-frames.js")
        .then((mod) => setFrames(mod.frames))
        .catch(() => setEnabled(false));
    }
  }, [enabled, frames, setEnabled]);

  if (!frames) return <Skeleton />;
  return <Canvas frames={frames} />;
}
```

### 2.3 Defer Non-Critical Third-Party Libraries

**Impact: MEDIUM (loads after hydration)**

Analytics, logging, and error tracking don't block user interaction. Load them lazily.

```tsx
// Incorrect: blocks initial bundle
import { Analytics } from "@vercel/analytics/react";

// Correct: loads after initial render
const Analytics = lazy(() =>
  import("@vercel/analytics/react").then((m) => ({ default: m.Analytics }))
);
```

### 2.4 Dynamic Imports for Heavy Components

**Impact: CRITICAL (directly affects TTI and LCP)**

Use `React.lazy` to lazy-load large components not needed on initial render.

```tsx
// Incorrect: Monaco bundles with main chunk ~300KB
import { MonacoEditor } from "./monaco-editor";

// Correct: Monaco loads on demand
const MonacoEditor = lazy(() =>
  import("./monaco-editor").then((m) => ({ default: m.MonacoEditor }))
);
```

### 2.5 Preload Based on User Intent

**Impact: MEDIUM (reduces perceived latency)**

```tsx
function EditorButton({ onClick }: { onClick: () => void }) {
  const preload = () => {
    void import("./monaco-editor");
  };

  return (
    <button onMouseEnter={preload} onFocus={preload} onClick={onClick}>
      Open Editor
    </button>
  );
}
```

---

## 3. Client-Side Data Fetching

**Impact: MEDIUM-HIGH**

### 3.1 Deduplicate Global Event Listeners

**Impact: LOW (single listener for N components)**

Use a shared subscription pattern to prevent N instances creating N listeners.

```tsx
// Incorrect: N instances = N listeners
function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === key) callback();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, callback]);
}

// Correct: use module-level Map to share listeners
const keyCallbacks = new Map<string, Set<() => void>>();

function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    if (!keyCallbacks.has(key)) keyCallbacks.set(key, new Set());
    keyCallbacks.get(key)!.add(callback);
    return () => {
      const set = keyCallbacks.get(key);
      if (set) {
        set.delete(callback);
        if (set.size === 0) keyCallbacks.delete(key);
      }
    };
  }, [key, callback]);
}
```

### 3.2 Use Passive Event Listeners for Scrolling Performance

**Impact: MEDIUM (eliminates scroll delay)**

Add `{ passive: true }` to touch and wheel event listeners to enable immediate scrolling.

```typescript
// Incorrect
document.addEventListener("touchstart", handleTouch);
document.addEventListener("wheel", handleWheel);

// Correct
document.addEventListener("touchstart", handleTouch, { passive: true });
document.addEventListener("wheel", handleWheel, { passive: true });
```

**Use passive when:** tracking/analytics, logging, any listener that doesn't call `preventDefault()`.
**Don't use passive when:** custom swipe gestures, custom zoom controls.

### 3.3 Use SWR / React Query for Automatic Deduplication

**Impact: MEDIUM-HIGH (automatic deduplication)**

```tsx
// Incorrect: no deduplication, each instance fetches
function UserList() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then(setUsers);
  }, []);
}

// Correct: multiple instances share one request
import useSWR from "swr";
function UserList() {
  const { data: users } = useSWR("/api/users", fetcher);
}
```

### 3.4 Version and Minimize localStorage Data

**Impact: MEDIUM (prevents schema conflicts, reduces storage size)**

```typescript
const VERSION = "v2";

function saveConfig(config: { theme: string; language: string }) {
  try {
    localStorage.setItem(`userConfig:${VERSION}`, JSON.stringify(config));
  } catch {}
}

function loadConfig() {
  try {
    const data = localStorage.getItem(`userConfig:${VERSION}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}
```

**Always wrap in try-catch:** `getItem()` and `setItem()` throw in incognito/private browsing, quota exceeded, or disabled.

---

## 4. Re-render Optimization

**Impact: MEDIUM**

### 4.1 Calculate Derived State During Rendering

**Impact: MEDIUM (avoids redundant renders and state drift)**

```tsx
// Incorrect: redundant state and effect
const [fullName, setFullName] = useState("");
useEffect(() => {
  setFullName(firstName + " " + lastName);
}, [firstName, lastName]);

// Correct: derive during render
const fullName = firstName + " " + lastName;
```

### 4.2 Defer State Reads to Usage Point

**Impact: MEDIUM (avoids unnecessary subscriptions)**

```tsx
// Incorrect: subscribes to all searchParams changes
const searchParams = useSearchParams();
const handleShare = () => {
  const ref = searchParams.get("ref");
  shareChat(chatId, { ref });
};

// Correct: reads on demand, no subscription
const handleShare = () => {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get("ref");
  shareChat(chatId, { ref });
};
```

### 4.3 Don't Wrap Simple Primitives in useMemo

**Impact: LOW-MEDIUM**

```tsx
// Incorrect: useMemo overhead > expression cost
const isLoading = useMemo(
  () => user.isLoading || notifications.isLoading,
  [user.isLoading, notifications.isLoading]
);

// Correct
const isLoading = user.isLoading || notifications.isLoading;
```

### 4.4 Don't Define Components Inside Components

**Impact: HIGH (prevents remount on every render)**

```tsx
// Incorrect: remounts on every render
function UserProfile({ user, theme }) {
  const Avatar = () => (
    <img
      src={user.avatarUrl}
      className={theme === "dark" ? "avatar-dark" : "avatar-light"}
    />
  );
  return <Avatar />;
}

// Correct: pass props instead
function Avatar({ src, theme }: { src: string; theme: string }) {
  return (
    <img
      src={src}
      className={theme === "dark" ? "avatar-dark" : "avatar-light"}
    />
  );
}
function UserProfile({ user, theme }) {
  return <Avatar src={user.avatarUrl} theme={theme} />;
}
```

**Symptoms:** Input fields lose focus, animations restart, useEffect re-runs, scroll resets.

### 4.5 Extract Default Non-primitive Values from Memoized Components

**Impact: MEDIUM (restores memoization)**

```tsx
// Incorrect: onClick has different values on every rerender
const UserAvatar = memo(function UserAvatar({ onClick = () => {} }: Props) { ... })

// Correct: stable default value
const NOOP = () => {};
const UserAvatar = memo(function UserAvatar({ onClick = NOOP }: Props) { ... })
```

### 4.6 Narrow Effect Dependencies

**Impact: LOW (minimizes effect re-runs)**

```tsx
// Incorrect: re-runs on any user field change
useEffect(() => {
  console.log(user.id);
}, [user]);

// Correct: re-runs only when id changes
useEffect(() => {
  console.log(user.id);
}, [user.id]);
```

### 4.7 Put Interaction Logic in Event Handlers

**Impact: MEDIUM (avoids effect re-runs and duplicate side effects)**

```tsx
// Incorrect: event modeled as state + effect
const [submitted, setSubmitted] = useState(false);
useEffect(() => {
  if (submitted) post("/api/register");
}, [submitted]);

// Correct: do it in the handler
function handleSubmit() {
  post("/api/register");
}
```

### 4.8 Split Combined Hook Computations

**Impact: MEDIUM (avoids recomputing independent steps)**

```tsx
// Incorrect: changing sortOrder recomputes filtering
const sortedProducts = useMemo(() => {
  const filtered = products.filter((p) => p.category === category);
  return filtered.toSorted((a, b) =>
    sortOrder === "asc" ? a.price - b.price : b.price - a.price
  );
}, [products, category, sortOrder]);

// Correct: filtering only recomputes when products or category change
const filteredProducts = useMemo(
  () => products.filter((p) => p.category === category),
  [products, category]
);
const sortedProducts = useMemo(
  () =>
    filteredProducts.toSorted((a, b) =>
      sortOrder === "asc" ? a.price - b.price : b.price - a.price
    ),
  [filteredProducts, sortOrder]
);
```

### 4.9 Subscribe to Derived State

**Impact: MEDIUM (reduces re-render frequency)**

```tsx
// Incorrect: re-renders on every pixel change
const width = useWindowWidth();
const isMobile = width < 768;

// Correct: re-renders only when boolean changes
const isMobile = useMediaQuery("(max-width: 767px)");
```

### 4.10 Use Functional setState Updates

**Impact: MEDIUM (prevents stale closures)**

```tsx
// Incorrect: requires state as dependency
const addItems = useCallback(
  (newItems: Item[]) => {
    setItems([...items, ...newItems]);
  },
  [items]
); // items dependency causes recreations

// Correct: stable callbacks, no stale closures
const addItems = useCallback((newItems: Item[]) => {
  setItems((curr) => [...curr, ...newItems]);
}, []); // No dependencies needed
```

### 4.11 Use Lazy State Initialization

**Impact: MEDIUM (wasted computation on every render)**

```tsx
// Incorrect: runs on every render
const [searchIndex, setSearchIndex] = useState(buildSearchIndex(items));

// Correct: runs only once
const [searchIndex, setSearchIndex] = useState(() => buildSearchIndex(items));
```

### 4.12 Use Transitions for Non-Urgent Updates

**Impact: MEDIUM (maintains UI responsiveness)**

```tsx
import { startTransition } from "react";

// Incorrect: blocks UI on every scroll
const handler = () => setScrollY(window.scrollY);

// Correct: non-blocking updates
const handler = () => {
  startTransition(() => setScrollY(window.scrollY));
};
```

### 4.13 Use useDeferredValue for Expensive Derived Renders

**Impact: MEDIUM (keeps input responsive during heavy computation)**

```tsx
function Search({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const filtered = useMemo(
    () => items.filter((item) => fuzzyMatch(item, deferredQuery)),
    [items, deferredQuery]
  );
  const isStale = query !== deferredQuery;

  return (
    <>
      <input value={query} onChange={(e) => setQuery(e.target.value)} />
      <div style={{ opacity: isStale ? 0.7 : 1 }}>
        <ResultsList results={filtered} />
      </div>
    </>
  );
}
```

### 4.14 Use useRef for Transient Values

**Impact: MEDIUM (avoids unnecessary re-renders on frequent updates)**

```tsx
// Incorrect: renders every update
const [lastX, setLastX] = useState(0);
useEffect(() => {
  const onMove = (e: MouseEvent) => setLastX(e.clientX);
  window.addEventListener("mousemove", onMove);
  return () => window.removeEventListener("mousemove", onMove);
}, []);

// Correct: no re-render for tracking
const lastXRef = useRef(0);
const dotRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  const onMove = (e: MouseEvent) => {
    lastXRef.current = e.clientX;
    if (dotRef.current)
      dotRef.current.style.transform = `translateX(${e.clientX}px)`;
  };
  window.addEventListener("mousemove", onMove);
  return () => window.removeEventListener("mousemove", onMove);
}, []);
```

---

## 5. Rendering Performance

**Impact: MEDIUM**

### 5.1 Animate SVG Wrapper Instead of SVG Element

**Impact: LOW (enables hardware acceleration)**

```tsx
// Incorrect: no hardware acceleration
<svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24">...</svg>

// Correct: hardware accelerated
<div className="animate-spin">
  <svg width="24" height="24" viewBox="0 0 24 24">...</svg>
</div>
```

### 5.2 CSS content-visibility for Long Lists

**Impact: HIGH (faster initial render)**

```css
.message-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

For 1000 messages, browser skips layout/paint for ~990 off-screen items (10x faster initial render).

### 5.3 Hoist Static JSX Elements

**Impact: LOW (avoids re-creation)**

```tsx
// Incorrect: recreates element every render
function Container() {
  return (
    <div>{loading && <div className="h-20 animate-pulse bg-gray-200" />}</div>
  );
}

// Correct: reuses same element
const loadingSkeleton = <div className="h-20 animate-pulse bg-gray-200" />;
function Container() {
  return <div>{loading && loadingSkeleton}</div>;
}
```

Especially helpful for large and static SVG nodes.

### 5.4 Optimize SVG Precision

**Impact: LOW (reduces file size)**

```svg
<!-- Incorrect: excessive precision -->
<path d="M 10.293847 20.847362 L 30.938472 40.192837" />

<!-- Correct: 1 decimal place -->
<path d="M 10.3 20.8 L 30.9 40.2" />
```

Automate: `npx svgo --precision=1 --multipass icon.svg`

### 5.5 Use Explicit Conditional Rendering

**Impact: LOW (prevents rendering 0 or NaN)**

```tsx
// Incorrect: renders "0" when count is 0
{
  count && <span className="badge">{count}</span>;
}

// Correct: renders nothing when count is 0
{
  count > 0 ? <span className="badge">{count}</span> : null;
}
```

### 5.6 Use React DOM Resource Hints

**Impact: HIGH (reduces load time for critical resources)**

```tsx
import { preconnect, prefetchDNS, preload } from "react-dom";

export default function App() {
  prefetchDNS("https://analytics.example.com");
  preconnect("https://api.example.com");
  preload("/fonts/inter.woff2", {
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous"
  });
  return <main>{/* content */}</main>;
}
```

| API             | Use case                                    |
| --------------- | ------------------------------------------- |
| `prefetchDNS`   | Third-party domains you'll connect to later |
| `preconnect`    | APIs or CDNs you'll fetch from immediately  |
| `preload`       | Critical resources needed for current page  |
| `preloadModule` | JS modules for likely next navigation       |
| `preinit`       | Stylesheets/scripts that must execute early |
| `preinitModule` | ES modules that must execute early          |

### 5.7 Use useTransition Over Manual Loading States

**Impact: LOW (reduces re-renders and improves code clarity)**

```tsx
// Incorrect: manual loading state
const [isLoading, setIsLoading] = useState(false);
const handleSearch = async (value: string) => {
  setIsLoading(true);
  const data = await fetchResults(value);
  setResults(data);
  setIsLoading(false);
};

// Correct: useTransition with built-in pending state
const [isPending, startTransition] = useTransition();
const handleSearch = (value: string) => {
  setQuery(value);
  startTransition(async () => {
    const data = await fetchResults(value);
    setResults(data);
  });
};
```

---

## 6. JavaScript Performance

**Impact: LOW-MEDIUM**

Micro-optimizations for hot paths can add up to meaningful improvements.

### 6.1 Avoid Layout Thrashing

**Impact: MEDIUM (prevents forced synchronous layouts)**

```typescript
// Incorrect: interleaved reads and writes force reflows
element.style.width = "100px";
const width = element.offsetWidth; // Forces reflow
element.style.height = "200px";

// Correct: batch writes, then read once
element.style.width = "100px";
element.style.height = "200px";
const { width, height } = element.getBoundingClientRect();
```

Prefer CSS classes over inline styles when possible.

### 6.2 Build Index Maps for Repeated Lookups

**Impact: LOW-MEDIUM (1M ops to 2K ops)**

```typescript
// Incorrect (O(n) per lookup)
orders.map((order) => ({
  ...order,
  user: users.find((u) => u.id === order.userId)
}));

// Correct (O(1) per lookup)
const userById = new Map(users.map((u) => [u.id, u]));
orders.map((order) => ({
  ...order,
  user: userById.get(order.userId)
}));
```

### 6.3 Cache Repeated Function Calls

**Impact: MEDIUM (avoid redundant computation)**

```typescript
const slugifyCache = new Map<string, string>();

function cachedSlugify(text: string): string {
  if (slugifyCache.has(text)) return slugifyCache.get(text)!;
  const result = slugify(text);
  slugifyCache.set(text, result);
  return result;
}
```

### 6.4 Cache Storage API Calls

**Impact: LOW-MEDIUM (reduces expensive I/O)**

`localStorage`, `sessionStorage`, and `document.cookie` are synchronous and expensive. Cache reads in memory.

```typescript
const storageCache = new Map<string, string | null>();

function getLocalStorage(key: string) {
  if (!storageCache.has(key)) {
    storageCache.set(key, localStorage.getItem(key));
  }
  return storageCache.get(key);
}

function setLocalStorage(key: string, value: string) {
  localStorage.setItem(key, value);
  storageCache.set(key, value);
}
```

Invalidate on external changes:

```typescript
window.addEventListener("storage", (e) => {
  if (e.key) storageCache.delete(e.key);
});
```

### 6.5 Combine Multiple Array Iterations

**Impact: LOW-MEDIUM (reduces iterations)**

```typescript
// Incorrect: 3 iterations
const admins = users.filter((u) => u.isAdmin);
const testers = users.filter((u) => u.isTester);
const inactive = users.filter((u) => !u.isActive);

// Correct: 1 iteration
const admins: User[] = [];
const testers: User[] = [];
const inactive: User[] = [];
for (const user of users) {
  if (user.isAdmin) admins.push(user);
  if (user.isTester) testers.push(user);
  if (!user.isActive) inactive.push(user);
}
```

### 6.6 Defer Non-Critical Work with requestIdleCallback

**Impact: MEDIUM (keeps UI responsive)**

```typescript
function handleSearch(query: string) {
  const results = searchItems(query);
  setResults(results);

  requestIdleCallback(() => analytics.track("search", { query }));
  requestIdleCallback(() => saveToRecentSearches(query));
}

// With fallback
const scheduleIdleWork =
  window.requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1));
```

### 6.7 Hoist RegExp Creation

**Impact: LOW-MEDIUM (avoids recreation)**

```tsx
// Incorrect: new RegExp every render
const regex = new RegExp(`(${query})`, "gi");

// Correct: memoize
const regex = useMemo(
  () => new RegExp(`(${escapeRegex(query)})`, "gi"),
  [query]
);

// Or hoist static regex to module level
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
```

### 6.8 Use flatMap to Map and Filter in One Pass

**Impact: LOW-MEDIUM (eliminates intermediate array)**

```typescript
// Incorrect: 2 iterations
const userNames = users
  .map((user) => (user.isActive ? user.name : null))
  .filter(Boolean);

// Correct: 1 iteration
const userNames = users.flatMap((user) => (user.isActive ? [user.name] : []));
```

### 6.9 Use Set/Map for O(1) Lookups

**Impact: LOW-MEDIUM**

```typescript
// Incorrect (O(n) per check)
const allowedIds = ["a", "b", "c"];
items.filter((item) => allowedIds.includes(item.id));

// Correct (O(1) per check)
const allowedIds = new Set(["a", "b", "c"]);
items.filter((item) => allowedIds.has(item.id));
```

### 6.11 Use toSorted() Instead of sort() for Immutability

**Impact: MEDIUM-HIGH (prevents mutation bugs in React state)**

```typescript
// Incorrect: mutates the users prop array
const sorted = users.sort((a, b) => a.name.localeCompare(b.name));

// Correct: creates new array
const sorted = users.toSorted((a, b) => a.name.localeCompare(b.name));

// Fallback for older browsers
const sorted = [...items].sort((a, b) => a.value - b.value);
```

Other immutable methods: `.toReversed()`, `.toSpliced()`, `.with()`

---

## 7. Advanced Patterns

**Impact: LOW**

### 7.1 Initialize App Once, Not Per Mount

**Impact: LOW-MEDIUM (avoids duplicate init in development)**

```tsx
// Incorrect: runs twice in dev, re-runs on remount
useEffect(() => {
  loadFromStorage();
  checkAuthToken();
}, []);

// Correct: once per app load
let didInit = false;
function Comp() {
  useEffect(() => {
    if (didInit) return;
    didInit = true;
    loadFromStorage();
    checkAuthToken();
  }, []);
}
```

### 7.2 Store Event Handlers in Refs

**Impact: LOW (stable subscriptions)**

```tsx
// Incorrect: re-subscribes on every render
function useWindowEvent(event: string, handler: (e) => void) {
  useEffect(() => {
    window.addEventListener(event, handler);
    return () => window.removeEventListener(event, handler);
  }, [event, handler]);
}

// Correct: stable subscription with useEffectEvent (React 19+)
import { useEffectEvent } from "react";
function useWindowEvent(event: string, handler: (e) => void) {
  const onEvent = useEffectEvent(handler);
  useEffect(() => {
    window.addEventListener(event, onEvent);
    return () => window.removeEventListener(event, onEvent);
  }, [event]);
}
```

### 7.3 useEffectEvent for Stable Callback Refs

**Impact: LOW (prevents effect re-runs)**

```tsx
// Incorrect: effect re-runs on every callback change
useEffect(() => {
  const timeout = setTimeout(() => onSearch(query), 300);
  return () => clearTimeout(timeout);
}, [query, onSearch]);

// Correct: stable reference with useEffectEvent
const onSearchEvent = useEffectEvent(onSearch);
useEffect(() => {
  const timeout = setTimeout(() => onSearchEvent(query), 300);
  return () => clearTimeout(timeout);
}, [query]);
```

---

## 8. Mutation Patterns

### 8.1 Mutations Must Be User-Triggered, Never on Mount

**Rule**: Mutations (POST/PUT/DELETE — email sends, DB writes, analytics fires) must be triggered by **explicit user action** (click/submit handler). NEVER place them in `useEffect` on mount.

**Why:**

- React 18+ StrictMode dev: mount → cleanup → re-mount → effect runs **twice**. Non-idempotent mutations send 2 real requests.
- `useEffect` is for synchronizing with external systems, not one-shot side effects on mount.
- `useRef` guard blocks StrictMode double-fire but masks the design smell.

**Anti-pattern:**

```tsx
// ❌ Mutation auto-fires on mount
const { mutate } = useMutation({ mutationFn: () => sendOtp(email) });
useEffect(() => {
  mutate();
}, []);

// ❌ useRef guard — band-aid, not a fix
const fired = useRef(false);
useEffect(() => {
  if (fired.current) return;
  fired.current = true;
  mutate();
}, []);
```

**Correct — move trigger to source page:**

```tsx
// ✅ Source page fires mutation + navigates in same click handler
const { mutate: sendOtp } = useMutation({
  mutationFn: () => api.sendOtp(email)
});
<OptionCard href="/target" onSelect={() => sendOtp()} />;

// ✅ Target page: render-only, no mount side effects
const TargetPage = () => (
  <>
    <ResendButton />
    <OtpInput />
  </>
);
```

If UX requires "auto-send on page load" → move trigger to the **previous page** (navigation source). Fire mutation in the click handler that also calls `router.push()`. Target page renders UI only.

**Exception (rare):** If auto-fire on mount is truly unavoidable: BE must have idempotency key/cooldown guard + document in code why this anti-pattern is intentional.

---

## 9. Project Coding Conventions

Enforced React conventions for this project (structure & patterns; the performance rules above still apply).

### 9.1 Component Structure

- Named function exports with inline prop types — never untyped `props`
- Prefer composition over prop drilling
- One component per file, max 250 lines
- No index as `key` — use stable IDs
- Wrap critical features with error boundaries (`react-error-boundary`)
- Callback props use `on` prefix (`onClick`, `onSubmit`); handler functions use `handle` prefix (`handleClick`, `handleSubmit`)
- Non-UI logic (API fetches, business logic) lives in `page_name/ghosts/` as headless components that `return null` — import and render them as regular components where needed

### 9.2 React TypeScript

- `useId()` for unique IDs (form labels, ARIA) — never `Math.random()`/`uuid` (hydration mismatch)
- No `React.FC` — inline prop types directly in the parameter, never extract a separate `Props` interface

  ```tsx
  // Good
  const Checkbox = ({ checked }: { checked: boolean }) => { ... }
  // Bad — unnecessary interface extraction
  interface CheckboxProps { checked: boolean }
  const Checkbox = ({ checked }: CheckboxProps) => { ... }
  ```

- `ComponentProps<'button'>` to extend native element props
- Prefer `as const` over `enum` — enums emit extra runtime IIFE in the bundle; `as const` is erased at compile time

### 9.3 State Management

- `useSyncExternalStore` to subscribe to external stores (browser APIs, third-party state, shared modules) — consistent state vs scattered `useState` + `useEffect` syncs

**State Decision Guide:**

- **Local**: `useState` / `useReducer` for component-scoped state
- **Derived**: compute during render — no state sync
- **Context**: DI, theme, auth — not for high-frequency updates
- **Global**: Zustand/Redux for complex app-wide state
- **Server**: React Query / SWR — server cache ≠ UI state
- **URL**: store filters/sort/pagination in URL as source of truth

### 9.4 Custom Hooks

- Always clean up side effects in `useEffect` return
- `useEffect` for non-paint-blocking side effects (data fetching, subscriptions, logging); `useLayoutEffect` for DOM measurements/mutations before paint (tooltip positioning, scroll restoration, flicker prevention)
- `MutationObserver` / `IntersectionObserver` / `ResizeObserver` inside `useEffect` for DOM-change / viewport / size tracking — always `disconnect()` in cleanup
- `exhaustive-deps` is law — never suppress, fix the logic instead

### 9.5 Accessibility (React-specific)

- `<button>` for actions, `<a>`/`<Link>` for navigation — not `<div onClick>`
- Navigation uses TanStack Router's `<Link>` (from `@tanstack/react-router`); for active styling pass `activeProps`/`activeOptions` — there is no separate `NavLink`
- Errors inline next to fields, focus first error on submit
- Warn before navigation with unsaved changes (`beforeunload` or router guard)

### 9.6 Forms

- Never block paste (`onPaste` + `preventDefault`)
- Disable `spellCheck` on emails, codes, usernames
- `autocomplete="off"` on non-auth fields to avoid password-manager triggers
- Search inputs triggering API calls must combine `useTransition` + debounce + `AbortController` (cancel previous request — prevents stale out-of-order data)
- Prefer uncontrolled inputs; controlled inputs must be cheap per keystroke

### 9.7 Hydration Safety

- Inputs with `value` need `onChange` (or `defaultValue` for uncontrolled)
- Guard date/time rendering against server-vs-client hydration mismatch

---

## 10. Frontend Performance — Vite / TanStack Start & Ops

Operational performance beyond component-level patterns (§1–7). Optimization priority (highest impact first): eliminate unnecessary work → defer non-critical → optimize critical path → cache aggressively → compress/minify → monitor continuously.

### 10.1 Third-Party Scripts

- Load third-party scripts with the native `defer` / `async` attributes (via a route's `head().scripts`), or inject them after hydration in a `useEffect`. Never block first paint with a synchronous analytics/chat script.
- Offload analytics/tracking to web workers (Partytown); self-host critical third-party resources; enforce a third-party JS budget in CI.

### 10.2 Images & Fonts

- There is no `next/image` here. Use a plain `<img>` with the right attributes: serve WebP/AVIF, always set explicit `width`/`height` (or reserve an `aspect-ratio` box) to prevent CLS, add `srcset`/`sizes` for responsive, `loading="lazy"` + `decoding="async"` for below-fold images.
- The LCP image (1–2 per page) must be eager: `loading="eager"` + `fetchpriority="high"`, and preloaded via a route `head().links` `rel="preload"`. Never `loading="lazy"` on the LCP element.
- Fonts: self-host (`.woff2`) and preload the critical face via `head().links`; use `font-display: swap`; prefer variable fonts. Do not pull fonts from a third-party CDN at runtime (extra DNS/connection + a CSP concern).

### 10.3 Dynamic Imports (code-splitting)

- Use `React.lazy` + `Suspense` (or a plain Vite dynamic `import()`) to split heavy, non-initial components (editors, charts, maps, PDF viewers). Vite code-splits each dynamic `import()` into its own chunk automatically.
- For browser-only components that must not run during SSR, gate rendering on the client (mount flag / `useEffect`) rather than a Next-style `ssr: false` flag — that option does not exist here.

  ```tsx
  import { lazy, Suspense } from "react";
  import { Skeleton } from "antd";

  const Chart = lazy(() => import("#/components/Chart"));

  const Panel = () => (
    <Suspense fallback={<Skeleton active className="h-96 w-full" />}>
      <Chart />
    </Suspense>
  );
  ```

### 10.4 Video

- Prefer WebM (VP9)/AV1, fallback MP4 (H.264); `preload="none"`/`"metadata"` for non-hero; poster placeholders; set `width`/`height` or `aspect-ratio` to prevent CLS

### 10.5 CDN & Caching

- HTML: `Cache-Control: no-cache` / short max-age; hashed static assets: `public, max-age=31536000, immutable`; API: `stale-while-revalidate` where appropriate; ETags for dynamic resources
- Serve static from CDN, edge-cache matching rendering strategy (SSG cached, SSR not), HTTP/2-3, Brotli at edge
- Service workers (only if PWA): stale-while-revalidate for app shell, cache-first for versioned assets, network-first for fresh API data (Workbox)

### 10.6 Build & CI/CD Gates

- Bundle analysis: inspect the Vite/Rollup output (add `rollup-plugin-visualizer` to `vite.config.ts` when needed); budget ≤ 200KB JS (compressed) for critical pages
- Lighthouse CI on every PR (fail below thresholds); bundle-size budgets (`size-limit`/`bundlesize`); track CWV in CI; Brotli + Gzip fallback (target > 70% ratio)

### 10.7 Monitoring & Measurement

- **Lab**: Lighthouse / Lighthouse CI, WebPageTest, DevTools Performance panel
- **Field (RUM)**: CrUX, `web-vitals` lib (`onLCP`/`onINP`/`onCLS`), Vercel Analytics/Datadog RUM
- Measure at p75, segment by device/connection/geo, alert on CWV regressions, track trends not snapshots

### 10.8 Performance Audit Workflow

1. Baseline (Lighthouse + CrUX) → 2. optimize LCP element delivery (preload + `fetchpriority="high"`, eager LCP image) → 3. fix CLS (missing dimensions, late content) → 4. profile INP (slow interactions) → 5. analyze bundle (Vite/Rollup output, `rollup-plugin-visualizer`) → 6. review network waterfall (blocking resources, preloads) → 7. check caching/CDN → 8. image optimization → 9. third-party script impact → 10. document findings by impact. Always measure before optimizing; highest-impact lowest-effort first; never sacrifice accessibility for performance.
