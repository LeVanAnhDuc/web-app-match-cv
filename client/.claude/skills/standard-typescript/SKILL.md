---
name: standard-typescript
description: TypeScript/JavaScript coding standards for the frontend (TanStack Start + React, Vite). Use when writing or reviewing client-side .ts/.tsx/.js/.jsx files — covers type safety, tsconfig, generics, async patterns, error handling, immutability, imports, React/TSX typing, and naming conventions.
user-invocable: false
---

> Sources: TypeScript official docs (typescriptlang.org), Google TypeScript Style Guide, TypeScript Do's and Don'ts handbook.
>
> **Frontend (TanStack Start + React, Vite) variant** — examples target the browser/DOM and React. For the Node backend variant see `server/.claude/skills/standard-typescript`.

---

## tsconfig.json — Required Settings

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "esModuleInterop": true,
    "incremental": true,
    "skipLibCheck": true
  }
}
```

`strict: true` enables: `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, `alwaysStrict`.

> **Frontend resolution**: bundled by Vite, so use `module: "ESNext"` + `moduleResolution: "Bundler"`, `jsx: "react-jsx"` (Vite/esbuild handles the JSX transform — no runtime import needed), `allowImportingTsExtensions: true`, and include `"DOM"` in `lib`. The path alias `#/*` → `./src/*` is declared in `tsconfig.json` `paths` (mirrored in `package.json` `imports`). Type-check with `npx tsc --noEmit` (the build via `vite build` does not type-check).

Additional required flags:

| Flag                         | Enforces                                                 |
| ---------------------------- | -------------------------------------------------------- |
| `noUncheckedIndexedAccess`   | Array/object index returns `T \| undefined`, not `T`     |
| `noImplicitReturns`          | All code paths must return a value                       |
| `noFallthroughCasesInSwitch` | `switch` cases must have `break` or `return`             |
| `exactOptionalPropertyTypes` | Distinguishes `undefined` from missing optional property |
| `noImplicitOverride`         | Requires `override` keyword on overridden methods        |
| `verbatimModuleSyntax`       | Enforces `import type` for type-only imports             |
| `incremental`                | Enables `.tsbuildinfo` cache for faster rebuilds         |

---

## Type vs Interface

- `interface` for object shapes that may be extended or implemented by a class
- `type` for unions, intersections, mapped types, conditional types, and primitives
- Never use `interface` for unions

```ts
interface User {
  id: string;
  name: string;
  email: string;
}

type Status = "pending" | "approved" | "rejected";
type AdminUser = User & { role: "admin" };
type UpdateUserInput = Partial<Pick<User, "name" | "email">>;
```

---

## Forbidden Patterns (Official TypeScript Do's and Don'ts)

### Boxed primitives — never use

```ts
// ❌
function parse(s: String): Number {}

// ✅
function parse(s: string): number {}
```

Never use `Number`, `String`, `Boolean`, `Symbol`, `Object` as types. Use `number`, `string`, `boolean`, `symbol`, `object` or `Record<string, unknown>`.

### `any` — forbidden except during JS migration

```ts
// ❌
const data: any = fetchData();

// ✅
const data: unknown = fetchData();
if (isUser(data)) {
  data.name;
}
```

### `as` type assertion — last resort only

```ts
// ❌ Assertion without verification
const user = response.data as User;

// ✅ Type guard first, then use
function isUser(x: unknown): x is User {
  return typeof x === "object" && x !== null && "id" in x;
}
if (isUser(response.data)) {
  response.data.name;
}

// ❌ Double assertion — always wrong
const x = foo as unknown as Bar;
```

### Non-null assertion `!` — forbidden without structural guarantee

```ts
// ❌
const el = document.getElementById("app")!;

// ✅
const el = document.getElementById("app");
if (!el) throw new Error("Element #app not found");
el.style.display = "none";
```

### `@ts-ignore` — never use

```ts
// ❌
// @ts-ignore

// ✅ Only with explanation, only when suppressing a known TS bug
// @ts-expect-error: TS incorrectly infers return type — tracked in #1234
```

---

## Null & Undefined Handling

- `null` = intentionally absent value
- `undefined` = value was never set
- Never use `||` for defaults when `0` or `''` are valid values — use `??`

```ts
// ❌
const name = user.name || "stranger"; // treats '' as falsy

// ✅
const name = user.name ?? "stranger";

// ✅ Optional chaining
console.log(user?.address?.city);
```

---

## Type Narrowing

```ts
// typeof
if (typeof value === "string") {
  value.toUpperCase();
}

// instanceof
if (error instanceof AppError) {
  error.code;
}

// Discriminated union
type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rect"; width: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rect":
      return shape.width * shape.height;
    default:
      return assertNever(shape);
  }
}

// Exhaustiveness check
function assertNever(x: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(x)}`);
}
```

---

## Generics

- Generic type parameter must be used — never create a generic that ignores its parameter
- Constrain with `extends` when specific properties are needed
- Descriptive names for multiple parameters: `TKey`, `TValue`, not `T`, `U`

```ts
// ❌ Useless generic
function wrap<T>(): void {}

// ✅
function wrap<T>(value: T): { value: T } {
  return { value };
}

// Constraint
function getProperty<TObj, TKey extends keyof TObj>(
  obj: TObj,
  key: TKey
): TObj[TKey] {
  return obj[key];
}

// Result type pattern
type Result<T> = { success: true; data: T } | { success: false; error: string };
```

---

## Utility Types — Use Instead of Manual Duplication

```ts
Partial<T>; // all properties optional
Required<T>; // all properties required
Readonly<T>; // all properties readonly
Pick<T, K>; // select subset of properties
Omit<T, K>; // exclude properties
Record<K, V>; // object with keys K and values V
ReturnType<T>; // infer return type of function
Parameters<T>; // infer parameter types of function
NonNullable<T>; // exclude null and undefined
Awaited<T>; // unwrap Promise type
```

---

## Function Types

- `void` return type for callbacks whose value is ignored — never `any`
- Prefer optional parameters over multiple overloads for trailing params
- Prefer union types over overloads that differ only in argument type
- Sort overloads from most specific to most general

```ts
// ❌
function run(cb: () => any): void {
  cb();
}
// ✅
function run(cb: () => void): void {
  cb();
}

// ❌ Overloads for trailing optional
function create(name: string): User;
function create(name: string, role: string): User;
// ✅
function create(name: string, role?: string): User;

// ❌ Overloads differing only by argument type
function format(x: string): string;
function format(x: number): string;
// ✅
function format(x: string | number): string;
```

---

## Immutability

- Use spread operator over direct mutation
- Use `Readonly<T>` and `readonly` for data that should not be modified
- Prefer `.map()`, `.filter()`, `.reduce()` over mutating loops

```ts
// ❌
obj.key = val;
arr.push(item);

// ✅
const newObj = { ...obj, key: val };
const newArr = [...arr, item];

// readonly in interfaces
interface Point {
  readonly x: number;
  readonly y: number;
}

// ReadonlyArray
function process(items: readonly string[]): void {}
```

---

## Enums — Avoid, Use Union Types Instead

```ts
// ❌ Enum — generates runtime JS, not tree-shakeable
enum Direction {
  Up = "UP",
  Down = "DOWN"
}

// ✅ Union type — zero runtime cost
type Direction = "UP" | "DOWN";

// ✅ Const object — when runtime values needed
const Direction = { Up: "UP", Down: "DOWN" } as const;
type Direction = (typeof Direction)[keyof typeof Direction];
```

---

## `const` and `satisfies`

```ts
// as const — preserves literal types
const config = { host: "localhost", port: 3000 } as const;

// satisfies — validates type without widening inference
const palette = {
  red: ["#ff0000"]
} satisfies Record<string, string[]>;
// palette.red is still string[], not widened
```

---

## Async Patterns

- `Promise.all()` for independent concurrent calls — never sequential when unnecessary
- `Promise.allSettled()` when partial failure is acceptable
- Always handle promise rejections — an unhandled rejection surfaces as a `window` `unhandledrejection` event and breaks the UI flow. In React, let async state land through React Query / a state setter, never a floating `.then()` in render

```ts
// ❌ Sequential — adds full latency per call
const user = await getUser(id);
const orders = await getOrders(id);

// ✅ Parallel
const [user, orders] = await Promise.all([getUser(id), getOrders(id)]);

// When partial failure is OK
const results = await Promise.allSettled([fetchA(), fetchB()]);
results.forEach((r) => {
  if (r.status === "fulfilled") use(r.value);
  else log(r.reason);
});
```

---

## Error Handling

- `catch` type is `unknown` in strict mode — always narrow before use
- Use typed error classes for domain-specific failures
- Always check `response.ok` before parsing fetch responses

```ts
// ✅ Narrow catch type
try {
  await doSomething();
} catch (e) {
  if (e instanceof Error) console.error(e.message);
  else console.error(String(e));
}

// ✅ Typed error class
class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

// ✅ Check response.ok
const res = await fetch(url);
if (!res.ok) throw new AppError("FETCH_FAILED", `HTTP ${res.status}`);
const data = await res.json();
```

---

## Imports

```ts
// ❌ Regular import for type
import { User } from "./types";

// ✅ Type-only import
import type { User } from "./types";

// ✅ Mixed
import { fetchUser, type User } from "./api";
```

- Export convention is governed by `.claude/rules/` (see `component-folder.md`), not this skill. In this project:
  - **Component `index.tsx` files → `export default`** (project convention: one component per folder, arrow function, one const per file).
  - **TanStack route files (`src/routes/**`) → named `export const Route = createFileRoute(...)`** — framework contract, never default-export it.
  - **Everything else** (utils, hooks, requests, stores, types, constants) → **named exports**.
- Barrel files (`index.ts`): allowed in `types/`, `hooks/`, and public API surfaces only — not inside deep feature folders (barrel imports hurt bundle size, see `standard-react` §2.1).
- No circular dependencies — restructure or use `import type` to break cycles.

---

---

## React / TSX Typing

- **Inline prop types directly in the parameter — never `React.FC`, never a separate `Props` interface** (per `standard-react`). `React.FC` adds implicit `children` and weakens generics:

```tsx
// ✅ Inline prop types on the destructured parameter
function Button({ label, onClick }: { label: string; onClick: () => void }) { … }

// ❌ React.FC / extracted Props interface
const Button: React.FC<Props> = ({ label }) => { … };
interface Props { label: string }
```

- Event handlers use the precise DOM event type: `React.ChangeEvent<HTMLInputElement>`, `React.MouseEvent<HTMLButtonElement>` — never `any`.
- Callback props that ignore their return value are typed `() => void` (same rule as any callback); name them with the `on` prefix (`onClick`, `onSubmit`).
- `children` is `React.ReactNode`; a render-prop child is a function type, not `ReactNode`.
- Use `ComponentProps<'button'>` to extend native element props.
- Prefer discriminated-union props over boolean flags that are mutually exclusive.

---

## DO NOT

- Use `Number`, `String`, `Boolean`, `Symbol`, `Object` as types
- Use `any` in production code — use `unknown` + type guard
- Use `as` to bypass type errors — fix the type instead
- Use `// @ts-ignore` — use `// @ts-expect-error` with explanation
- Use `!` non-null assertion without a structural guarantee
- Use `||` for default values when `0` or `''` are valid — use `??`
- Create enums when union types or const objects suffice
- Use default exports outside component `index.tsx` files (per `.claude/rules/component-folder.md`) — utils/hooks/requests/stores/types use named exports
- Write overloads differing only in argument type — use union
- Duplicate type definitions when utility types can derive them
- Use generic parameters not referenced in the signature
- Use barrel files inside feature folders
- Hardcode date/number formats — use `Intl.*`
- Leave unhandled promise rejections

---

## Code Review Checklist

### Blocking

- [ ] `any` used in non-migration code
- [ ] `// @ts-ignore` present
- [ ] `as` assertion without prior type guard
- [ ] `!` non-null assertion without structural guarantee
- [ ] Boxed primitive types used: `String`, `Number`, `Boolean`, `Object`
- [ ] `catch (e)` with `e` used without narrowing
- [ ] `import type` missing for type-only import (`verbatimModuleSyntax`)
- [ ] Default export used outside a component `index.tsx` (utils/hooks/requests/stores/types must be named exports)
- [ ] Sequential `await` for independent operations
- [ ] Unhandled promise rejection

### Warning

- [ ] `interface` used for union — should be `type`
- [ ] Manual type duplication instead of utility type
- [ ] Enum used instead of union type or const object
- [ ] Overloads differing only in argument type — use union
- [ ] Generic parameter not referenced in signature
- [ ] `||` used for default when `0`/`''` is valid — use `??`
- [ ] `response.ok` not checked before `res.json()`
- [ ] Fetch/timer/subscription not cleaned up
- [ ] Date or number hardcoded format — use `Intl.*`

### Suggestion

- [ ] `satisfies` could replace type annotation to preserve literal types
- [ ] Discriminated union could replace boolean flag on type
- [ ] `readonly` missing on immutable properties
- [ ] JSDoc missing on exported function
- [ ] `@deprecated` tag missing on deprecated export
- [ ] `Promise.allSettled` could replace `Promise.all` for fault-tolerant flows
