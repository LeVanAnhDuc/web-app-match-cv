import type { Locator, Page } from "@playwright/test";
import { uiLanguage } from "@/components/ui-language";
import { t, type CopyKey, type Vars } from "@/data/copy";

// SignInGate (client/src/components/SignInGate) inside <main>:
//   variant "route"   a user-only route opened by a guest/anonymous visitor: <h2> gate.<route> · gate.description ·
//                     "Sign in with Ducker ID" (returnTo = current path) · "Back to matching"
//   variant "quota"   the 429 card of the wizard's step 4: <h2> gate.quotaTitle · gate.quotaDescription ·
//                     "Resets in <h> h <m> min" · "Sign in with Ducker ID" · "Back to home"

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const plain = (s: string) => s.replace(/<\/?\w+>/g, "");

export type GateRoute = "cv" | "jd" | "aiCredentials" | "myData";

export class SignInGate {
  constructor(readonly page: Page) {}

  private text(key: CopyKey, vars?: Vars): string {
    return t(key, uiLanguage(this.page), vars);
  }

  private main(): Locator {
    return this.page.getByRole("main");
  }

  routeTitle(route: GateRoute): Locator {
    return this.main().getByRole("heading", { level: 2, name: this.text(`gate.${route}`) });
  }

  quotaTitle(limit: number): Locator {
    return this.main().getByRole("heading", { level: 2, name: this.text("gate.quotaTitle", { limit }) });
  }

  quotaDescription(): Locator {
    return this.main().getByText(this.text("gate.quotaDescription"), { exact: true });
  }

  /** "Resets in <time>"; with `time` omitted, any countdown ("<h> h <m> min" or "<m> min"). */
  resetsIn(time?: string): Locator {
    if (time !== undefined) return this.main().getByText(plain(this.text("gate.resetsIn", { time })), { exact: true });
    const [before, after] = plain(this.text("gate.resetsIn", { time: "§" })).split("§");
    return this.main().getByText(new RegExp(`^${esc(before)}(\\d+ h )?\\d+ min${esc(after)}$`));
  }

  signInLink(): Locator {
    return this.main().getByRole("link", { name: this.text("auth.signInWithDucker"), exact: true });
  }

  backHomeLink(): Locator {
    return this.main().getByRole("link", { name: this.text("gate.backHome"), exact: true });
  }

  backMatchingLink(): Locator {
    return this.main().getByRole("link", { name: this.text("gate.backMatching"), exact: true });
  }
}
