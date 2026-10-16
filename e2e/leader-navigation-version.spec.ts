import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
const superEmail = process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com";
async function selectVersion(page: Page, version: "Existing" | "Redesigned") {
  await page.goto("/leader/settings");
  const button = page.getByRole("button", { name: `${version} navigation`, exact: true });
  await expect(button).toBeEnabled();
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}
async function openMenu(page: Page) {
  const toggle = page.getByRole("button", { name: /Leader Menu|Menu ·/ });
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await expect(page.getByRole("navigation", { name: "Leader navigation" })).toBeVisible();
}
async function expose(page: Page, category: string, redesigned: boolean, mobile: boolean) {
  await openMenu(page);
  const root = page.getByTestId(redesigned ? "leader-navigation-redesigned" : mobile ? "leader-navigation-mobile" : "leader-navigation-desktop");
  if (redesigned || mobile) {
    const toggle = root.getByRole("button", { name: category, exact: !redesigned });
    if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  }
  return root;
}

test("Superuser chooses both navigation versions; independent sessions retain routing, identity and access boundaries", async ({ page, browser }, testInfo) => {
  test.setTimeout(240_000);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  const mobile = testInfo.project.name === "mobile-chromium";
  await loginAsLeader(page, { email: superEmail, password: password! });
  let redesignedDestinations: string[] = [];
  try {
    for (const redesigned of [true, false]) {
      const mode = redesigned ? "Redesigned" : "Existing";
      await selectVersion(page, mode);
      await page.reload();
      await expect(page.getByRole("button", { name: `${mode} navigation`, exact: true })).toHaveAttribute("aria-pressed", "true");
      await openMenu(page);
      const modeRoot = page.getByTestId(redesigned ? "leader-navigation-redesigned" : mobile ? "leader-navigation-mobile" : "leader-navigation-desktop");
      const destinations: string[] = [];
      if (redesigned || mobile) {
        for (const category of await modeRoot.getByRole("button").all()) {
          if (await category.getAttribute("aria-expanded") !== "true") await category.click();
          destinations.push(...await modeRoot.getByRole("link").evaluateAll((links) => links.map((link) => `${link.getAttribute("data-testid")}:${link.getAttribute("href")}`)));
        }
      } else {
        destinations.push(...await modeRoot.getByRole("link").evaluateAll((links) => links.map((link) => `${link.getAttribute("data-testid")}:${link.getAttribute("href")}`)));
      }
      expect(new Set(destinations).size).toBe(destinations.length);
      expect(destinations.length).toBeGreaterThan(30);
      if (redesigned) redesignedDestinations = destinations.sort();
      else expect(destinations.sort()).toEqual(redesignedDestinations);
      await page.keyboard.press("Escape");
      // A fresh browser context proves the preference is not account/browser state.
      for (const account of [
        { email: "test.group.quartermaster@example.com", group: "Quartermaster / Bo’sun", id: "qm-reports", route: "/leader/qm-reports", identity: "qm-reports", hidden: "Secretary" },
        { email: "test.group.secretary@example.com", group: "Secretary", id: "secretary-meeting-records", route: "/leader/meetings?view=secretary", identity: "secretary-meeting-records", hidden: "Quartermaster / Bo’sun" },
        { email: process.env.E2E_LEADER_EMAIL || "test.scout.programme.scouter@example.com", group: "Programme", id: "weekly-meetings", route: "/leader/weekly", identity: "weekly-meetings", hidden: "Treasurer" },
        { email: "test.group.leader@example.com", group: "People & Parents", id: "member-management", route: "/leader/members", identity: "member-management", hidden: "Treasurer" },
        { email: "test.group.chairperson@example.com", group: "Group Operations", id: "group-meeting-records", route: "/leader/meetings?view=group-operations", identity: "group-meeting-records", hidden: "Treasurer" }
      ]) {
        const context = await browser.newContext({ baseURL: testInfo.project.use.baseURL || process.env.E2E_BASE_URL || "http://127.0.0.1:4173", viewport: mobile ? { width: 393, height: 851 } : { width: 1280, height: 900 } });
        try {
          const other = await context.newPage();
          await loginAsLeader(other, { email: account.email, password: password! });
          const navigation = await expose(other, account.group, redesigned, mobile);
          await expect(navigation.getByText(account.hidden, { exact: true })).toHaveCount(0);
          await expect(navigation.getByTestId("leader-nav-system-information")).toHaveCount(0);
          const destination = navigation.getByTestId(`leader-nav-${account.id}`);
          await expect(destination).toBeVisible();
          const bounds = await destination.boundingBox();
          expect(bounds!.height).toBeGreaterThanOrEqual(44);
          await destination.click();
          await expect(other).toHaveURL(new RegExp(account.route.replace(/[?]/g, "\\?") + "$"));
          await expect(other.getByTestId(`page-${account.identity}`)).toBeVisible();
          await other.reload();
          await expect(other.getByTestId(`page-${account.identity}`)).toBeVisible();
          await openMenu(other);
          const current = other.getByTestId(redesigned ? "leader-navigation-redesigned" : mobile ? "leader-navigation-mobile" : "leader-navigation-desktop").getByTestId(`leader-nav-${account.id}`);
          await expect(current).toHaveAttribute("aria-current", "page");
          // Browser/Android Back dismisses the menu before returning to Dashboard.
          await other.goBack();
          await expect(other.getByRole("navigation", { name: "Leader navigation" })).toBeHidden();
          await expect(other.getByTestId(`page-${account.identity}`)).toBeVisible();
          await other.goto("/leader/system");
          await expect(other).toHaveURL(/\/leader$/);
          await expect(other.getByTestId("page-system-information")).toHaveCount(0);
          await other.goto("/leader/settings");
          await expect(other.getByRole("button", { name: "Redesigned navigation", exact: true })).toHaveCount(0);
        } finally { await context.close(); }
      }
      await page.goto("/leader/qm-reports");
      await expect(page.getByTestId("page-qm-reports")).toBeVisible();
      const root = await expose(page, "Quartermaster / Bo’sun", redesigned, mobile);
      await expect(root.getByTestId("leader-nav-qm-reports")).toHaveAttribute("aria-current", "page");
      if (redesigned) {
        await page.screenshot({ path: testInfo.outputPath("redesigned-navigation.png"), fullPage: true });
        const toggle = root.getByRole("button", { name: /Programme/ });
        const history = await page.evaluate(() => window.history.length);
        await toggle.focus(); await page.keyboard.press("Enter");
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(root.getByRole("region", { name: /Quartermaster/ })).toHaveCount(0);
        expect(await page.evaluate(() => window.history.length)).toBe(history);
      }
    }
  } finally { await selectVersion(page, "Existing"); }
});
