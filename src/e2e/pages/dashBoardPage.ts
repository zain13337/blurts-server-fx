/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

import { Locator, Page } from "@playwright/test";

export class DashboardPage {
  readonly page: Page;
  readonly dataBreachEmailDropdown: Locator;
  readonly siteFoundImage: Locator;
  readonly breachStats: Locator;

  readonly dashboardNavButton: Locator;
  readonly fAQsNavButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.dataBreachEmailDropdown = page.locator("custom-select");
    this.siteFoundImage = page.locator("figure img");
    this.breachStats = page.locator("breach-stats");
    //sidebar nav
    this.dashboardNavButton = page.getByRole("link", { name: "Dashboard" });
    this.fAQsNavButton = page
      .getByLabel("Navigation")
      .getByRole("link", { name: "FAQs" });
  }

  async open() {
    await this.page.goto("/redesign/user/dashboard");
  }
}
