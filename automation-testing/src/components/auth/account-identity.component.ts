import type { Locator, Page } from "@playwright/test";
import { AppShell } from "@/components/app-shell.component";

// Who the shell says is signed in (client/src/layouts/AppShell/components/{UserCard,AccountMenu}, UserAvatar):
//   desktop, sidebar expanded     UserCard at the bottom of #app-sidebar: initials avatar, name (or email), email, Sign out
//   below lg / sidebar collapsed  "Account" avatar button (initials) → popover dialog "Account": name, email, Sign out
// The avatar is aria-hidden, so it is matched by its text (the initials).
export class AccountIdentity {
  readonly shell: AppShell;

  constructor(readonly page: Page) {
    this.shell = new AppShell(page);
  }

  /**
   * The region that shows the identity on this viewport: the sidebar (expanded desktop) or the Account popover,
   * which this opens when needed.
   */
  async open(): Promise<Locator> {
    if (await this.shell.isCompact()) {
      await this.shell.openAccountMenu();
      return this.shell.accountMenu();
    }
    return this.shell.sidebar();
  }

  /** Text inside `region` (name, email or initials), exact. */
  text(region: Locator, value: string): Locator {
    return region.getByText(value, { exact: true });
  }

  /**
   * The initials avatar on screen: in the sidebar UserCard on desktop, in the header "Account" button below lg (the
   * header copy exists but is hidden on desktop, hence the visibility filter).
   */
  avatar(initials: string): Locator {
    return this.page.getByText(initials, { exact: true }).filter({ visible: true }).first();
  }
}
