import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// src/__tests__/ -> src/
const SRC_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

// Generated — never hand-edited, and irrelevant to any hard-coded-className
// guard. Test files themselves are excluded via `isTestFile` below (their
// own asserted class strings, e.g. `not.toContain("text-faint")`, would
// otherwise trip a naive text scan).
const EXCLUDED_FILENAMES = new Set(["routeTree.gen.ts"]);

function isTestFile(fileName: string): boolean {
  return /\.test\.tsx?$/.test(fileName);
}

function walk(dir: string, acc: Array<string>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "__tests__") continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, acc);
      continue;
    }
    if (!/\.(?:ts|tsx)$/.test(entry.name)) continue;
    if (EXCLUDED_FILENAMES.has(entry.name)) continue;
    if (isTestFile(entry.name)) continue;
    acc.push(fullPath);
  }
}

/**
 * Every non-test `.ts`/`.tsx` source file under `src/`, excluding the
 * generated route tree and any `__tests__` directory. Shared by the
 * className guard tests (no-hardcoded-colour, no-faint-text) so the
 * enumeration logic — and its exclusions — lives in exactly one place.
 */
export function listSourceFiles(): Array<string> {
  const files: Array<string> = [];
  walk(SRC_ROOT, files);
  return files;
}

/** Absolute path -> a `src/...`-relative path, for readable failure output. */
export function relativeToSrc(filePath: string): string {
  return `src/${relative(SRC_ROOT, filePath).split("\\").join("/")}`;
}
