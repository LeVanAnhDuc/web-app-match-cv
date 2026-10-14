import { readFileSync } from "node:fs";
import { join } from "node:path";

// Text the tests assert on, read at RUNTIME from the app's own locale files, so a copy change in the app is picked up
// without touching the suite and no string is ever hand-copied into a spec.
//   UI text:         ../client/src/locales/<lng>/translation.json   (i18next, one namespace "translation")
//   Server messages: ../server/src/i18n/<lng>/<file>.json            (nestjs-i18n; key = "<file>.<path>")
// The key types come from the English files at compile time (resolveJsonModule), so a typo or a removed key is a
// typecheck error.

import type EnTranslation from "../../../client/src/locales/en/translation.json";
import type ServerAi from "../../../server/src/i18n/en/ai.json";
import type ServerAiCredentials from "../../../server/src/i18n/en/aiCredentials.json";
import type ServerAuth from "../../../server/src/i18n/en/auth.json";
import type ServerCommon from "../../../server/src/i18n/en/common.json";
import type ServerComparison from "../../../server/src/i18n/en/comparison.json";
import type ServerCoverLetters from "../../../server/src/i18n/en/coverLetters.json";
import type ServerCvRewrite from "../../../server/src/i18n/en/cvRewrite.json";
import type ServerDocuments from "../../../server/src/i18n/en/documents.json";
import type ServerMatching from "../../../server/src/i18n/en/matching.json";
import type ServerMe from "../../../server/src/i18n/en/me.json";

export type Lng = "en" | "vi";
export const LANGUAGES: readonly Lng[] = ["en", "vi"];

const APP_ROOT = join(__dirname, "..", "..", "..");
const CLIENT_LOCALES = join(APP_ROOT, "client", "src", "locales");
const SERVER_I18N = join(APP_ROOT, "server", "src", "i18n");

type Json = { [key: string]: string | Json };

/** Dotted paths to every string leaf of a JSON object type. */
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

type PluralSuffix = "zero" | "one" | "two" | "few" | "many" | "other";
type PluralBase<K> = K extends `${infer B}_${PluralSuffix}` ? B : never;

/** Every UI key, plus the plural base of `foo_one` / `foo_other` (pick the form with `{ count }`). */
export type CopyKey = Leaves<typeof EnTranslation> | PluralBase<Leaves<typeof EnTranslation>>;

type ServerFiles = {
  ai: typeof ServerAi;
  aiCredentials: typeof ServerAiCredentials;
  auth: typeof ServerAuth;
  common: typeof ServerCommon;
  comparison: typeof ServerComparison;
  coverLetters: typeof ServerCoverLetters;
  cvRewrite: typeof ServerCvRewrite;
  documents: typeof ServerDocuments;
  matching: typeof ServerMatching;
  me: typeof ServerMe;
};
/** "documents.errors.notFound" = server/src/i18n/<lng>/documents.json → errors.notFound (what tDoc/tMe… pass). */
export type ServerKey = Leaves<ServerFiles>;

export type Vars = Record<string, string | number>;

const cache = new Map<string, Json>();
function load(path: string): Json {
  let json = cache.get(path);
  if (!json) {
    json = JSON.parse(readFileSync(path, "utf8")) as Json;
    cache.set(path, json);
  }
  return json;
}

function lookup(json: Json, path: string): string | undefined {
  let node: string | Json | undefined = json;
  for (const part of path.split(".")) {
    if (node === undefined || typeof node === "string") return undefined;
    node = node[part];
  }
  return typeof node === "string" ? node : undefined;
}

function interpolate(text: string, vars: Vars | undefined, pattern: RegExp): string {
  if (!vars) return text;
  return text.replace(pattern, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

const uiFile = (lng: Lng) => load(join(CLIENT_LOCALES, lng, "translation.json"));

function uiLookup(lng: Lng, key: string, vars?: Vars): string | undefined {
  const json = uiFile(lng);
  // i18next plural resolution: key_<Intl plural category> when `count` is given, then the bare key.
  if (vars && typeof vars.count === "number") {
    const form = lookup(json, `${key}_${new Intl.PluralRules(lng).select(vars.count)}`) ?? lookup(json, `${key}_other`);
    if (form !== undefined) return form;
  }
  return lookup(json, key);
}

/**
 * UI text as the app renders it: `t("nav.home")`, `t("auth.quota.left", "vi", { left: 2, limit: 3 })`.
 * i18next `{{var}}` interpolation and `_one`/`_other` plurals (via `count`). A key missing in `vi` falls back to `en`
 * like the app's `fallbackLng`; a key missing everywhere throws (a test bug, not an app bug).
 */
export function t(key: CopyKey, lng: Lng = "en", vars?: Vars): string {
  const text = uiLookup(lng, key, vars) ?? (lng === "en" ? undefined : uiLookup("en", key, vars));
  if (text === undefined) throw new Error(`copy: no UI string "${key}" in client/src/locales/${lng}/translation.json`);
  return interpolate(text, vars, /\{\{\s*(\w+)\s*\}\}/g);
}

/**
 * Server message as nestjs-i18n returns it for `lang` (the API resolves `?lang=` then Accept-Language; see
 * `api.lang("vi")`). nestjs-i18n interpolates `{var}`. Falls back to en like the server's `fallbackLanguage`.
 */
export function serverMessage(key: ServerKey, lng: Lng = "en", vars?: Vars): string {
  const [file, ...rest] = key.split(".");
  const read = (l: Lng) => lookup(load(join(SERVER_I18N, l, `${file}.json`)), rest.join("."));
  const text = read(lng) ?? (lng === "en" ? undefined : read("en"));
  if (text === undefined) throw new Error(`copy: no server message "${key}" in server/src/i18n/${lng}/${file}.json`);
  return interpolate(text, vars, /\{\s*(\w+)\s*\}/g);
}

/** Both languages at once, for specs that loop over `LANGUAGES`. */
export const tAll = (key: CopyKey, vars?: Vars): Record<Lng, string> => ({ en: t(key, "en", vars), vi: t(key, "vi", vars) });
