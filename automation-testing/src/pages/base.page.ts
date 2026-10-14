import type { Page } from "@playwright/test";

// Shared parts of every screen: components that appear everywhere (header, toast…) are created here.
// Relative URLs resolve against the project's baseURL (the web host).
export abstract class BasePage {
  constructor(readonly page: Page) {}
}
