import { requireVar, type EnvName } from "./env";

export interface Account {
  email: string;
  password: string;
}

// Fixed ACTIVE account: <ENV>_USER_EMAIL / <ENV>_USER_PASSWORD in .env.
export function getFixedAccount(env: EnvName, source: NodeJS.ProcessEnv = process.env): Account {
  const prefix = `${env.toUpperCase()}_USER`;
  return {
    email: requireVar(`${prefix}_EMAIL`, source),
    password: requireVar(`${prefix}_PASSWORD`, source),
  };
}
