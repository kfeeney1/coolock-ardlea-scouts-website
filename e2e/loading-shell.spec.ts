import { expect, test } from "@playwright/test";

test.describe("Stable loading shell", () => {
  test("keeps the public header mounted while a lazy route loads", async ({ page }) => {
    await page.goto("/");

    const brandLogo = page.getByRole("img", { name: "80th 160th Coolock Ardlea Scout Group" });
    await expect(brandLogo).toBeVisible();

    await page.evaluate(() => {
      const selector = 'img[alt="80th 160th Coolock Ardlea Scout Group"]';
      (window as Window & { __shellWasRemoved?: boolean }).__shellWasRemoved = false;
      const observer = new MutationObserver(() => {
        if (!document.querySelector(selector)) {
          (window as Window & { __shellWasRemoved?: boolean }).__shellWasRemoved = true;
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      (window as Window & { __shellObserver?: MutationObserver }).__shellObserver = observer;
    });

    // Follow the real React Router navigation at the active breakpoint. Desktop projects
    // expose the About link directly; mobile projects expose it through the navigation menu.
    const mobileMenuButton = page.getByRole("button", { name: "Open navigation menu" });
    if (await mobileMenuButton.isVisible()) {
      await mobileMenuButton.click();
      await page.getByRole("menuitem", { name: "About", exact: true }).click();
    } else {
      await page.getByRole("link", { name: "About", exact: true }).first().click();
    }

    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole("heading", { name: "About Us" })).toBeVisible();
    await expect(brandLogo).toBeVisible();

    const shellWasRemoved = await page.evaluate(() => {
      const state = window as Window & { __shellWasRemoved?: boolean; __shellObserver?: MutationObserver };
      state.__shellObserver?.disconnect();
      return state.__shellWasRemoved ?? false;
    });
    expect(shellWasRemoved).toBe(false);
  });
});

for (const destination of [
  { path: "/leader/events/create", title: "Create Event", collection: "events" },
  { path: "/leader/subs?view=treasurer", title: "Subs", collection: "subsAssignments" },
]) {
  test(`${destination.title} preserves its destination shell during slow authoritative reads`, async ({ page }, testInfo) => {
    test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Authenticated loading shells run on desktop and mobile Chromium.");
    const password = process.env.E2E_TEST_USER_PASSWORD;
    test.skip(!password, "Configure canonical E2E password.");
    await page.goto("/leader/login");
    await page.getByLabel("Email address").fill("test.webadmin@example.com");
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Leader Dashboard", exact: true })).toBeVisible();

    let release!: () => void;
    let observed!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const requestObserved = new Promise<void>((resolve) => { observed = resolve; });
    const listenChannel = /\/google\.firestore\.v1\.Firestore\/Listen\/channel/;
    const handler = async (route: import("@playwright/test").Route) => {
      const body = new URLSearchParams(route.request().postData() || "");
      const data = [...body.values()].join(" ");
      if (data.includes(`"collectionId":"${destination.collection}"`)) {
        observed();
        await barrier;
      }
      await route.continue();
    };
    await page.route(listenChannel, handler);
    try {
      await page.goto(destination.path);
      await requestObserved;
      await expect(page.getByRole("heading", { name: destination.title, exact: true })).toBeVisible();
      const menuButton = page.locator('button[aria-controls="leader-navigation"]');
      await expect(menuButton).toBeVisible();
      const originalButton = await menuButton.elementHandle();
      await menuButton.click();
      await expect(page.getByRole("navigation", { name: "Leader navigation" })).toBeVisible();
      if (destination.title === "Create Event") {
        await expect(page.getByLabel("Event title")).toBeVisible();
        await page.getByLabel("Event title").fill("Unsaved slow-load draft");
        await expect(page.getByRole("button", { name: "Create Event", exact: true })).toBeDisabled();
      } else {
        await expect(page.getByTestId("page-treasurer-subs")).toBeVisible();
        await expect(page.getByRole("status").filter({ hasText: "Loading Subs records" })).toBeVisible();
        await expect(page.getByTestId("subs-member-select")).toHaveCount(0);
      }
      release();
      if (destination.title === "Create Event") {
        await expect(page.getByRole("button", { name: "Create Event", exact: true })).toBeEnabled();
        await expect(page.getByLabel("Event title")).toHaveValue("Unsaved slow-load draft");
      } else {
        await expect(page.getByTestId("subs-member-select")).toBeVisible();
        await expect(page.getByRole("status").filter({ hasText: "Loading Subs records" })).toHaveCount(0);
      }
      await expect(page.getByRole("navigation", { name: "Leader navigation" })).toBeVisible();
      expect(await originalButton!.evaluate((button) => button.isConnected)).toBe(true);
    } finally {
      release();
      await page.unroute(listenChannel, handler);
    }
  });
}
