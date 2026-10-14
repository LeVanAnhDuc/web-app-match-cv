import type { EnvName } from "./env";

export interface SiteUrls {
  webUrl: string;
  apiUrl: string;
}

// Web and API base per environment, each a full URL: the API may sit on the web host under a path, on another port,
// or on another domain. Leave an env out when the site does not exist there.
const URLS: Partial<Record<EnvName, SiteUrls>> = {
  dev: { webUrl: "http://localhost:5300", apiUrl: "http://localhost:5200/api/v1" },
};

// undefined when the site has no URL for this env; playwright.config uses it so loading the config never throws.
// E2E_BASE_URL / E2E_API_BASE override the table for one run, e.g. a git worktree running the app beside the main
// checkout on other ports (the API must allow that web origin via its own CLIENT_ORIGIN).
export function findUrls(env: EnvName, source: NodeJS.ProcessEnv = process.env): SiteUrls | undefined {
  const urls = URLS[env];
  if (!urls) return undefined;
  return {
    webUrl: source.E2E_BASE_URL?.trim() || urls.webUrl,
    apiUrl: source.E2E_API_BASE?.trim() || urls.apiUrl,
  };
}

export function getUrls(env: EnvName, source: NodeJS.ProcessEnv = process.env): SiteUrls {
  const urls = findUrls(env, source);
  if (!urls) throw new Error(`Match CV has no URL for ENV=${env}`);
  return urls;
}
