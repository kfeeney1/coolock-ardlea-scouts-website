import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
async function mode(page: Page, redesigned: boolean) {
  await page.goto("/leader/settings");
  const choice = page.getByRole("button", { name: `${redesigned ? "Redesigned" : "Existing"} navigation`, exact: true });
  await expect(choice).toBeEnabled();
  if (await choice.getAttribute("aria-pressed") !== "true") await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
}

for (const redesigned of [false, true]) for (const width of [393, 320]) {
  test(`${redesigned ? "Redesigned" : "Existing"} mobile menu preserves identity and Back across ${width}px rotation`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Responsive mobile transitions use the Pixel 7 project.");
    test.skip(!password, "Configure canonical E2E credentials.");
    await page.setViewportSize({ width, height: 851 });
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    const trigger = page.locator('button[aria-controls="leader-navigation"]');
    const nav = page.getByRole("navigation", { name: "Leader navigation", exact: true });
    const root = () => page.getByTestId(redesigned ? "leader-navigation-redesigned" : "leader-navigation-mobile");
    const category = (id: string, label: string) => redesigned ? root().locator(`button[aria-controls="redesigned-${id}-panel"]`) : root().getByRole("button", { name: label, exact: true });
    const history = () => page.evaluate(() => ({ url: location.href, length: history.length, index: history.state.idx }));
    try {
      await mode(page, redesigned);
      await page.goto("/leader");
      await expect(page.getByTestId("admin-overview")).toBeVisible();
      await trigger.click();
      await expect.poll(() => page.evaluate(() => (window.history.state?.usr?.__coolockArdleaBackDismissStack || []).at(-1)?.startsWith("leader-navigation:") === true)).toBe(true);
      const before = await history();
      for (const [id, label] of [["programme", "Programme"], ["secretary", "Secretary"], ["quartermaster", "Quartermaster / Bo’sun"]]) {
        await category(id, label).click();
        await expect(category(id, label)).toHaveAttribute("aria-expanded", "true");
        await expect(root().locator('button[aria-expanded="true"]')).toHaveCount(1);
      }
      await category("quartermaster", "Quartermaster / Bo’sun").click();
      await expect(root().getByRole("region")).toHaveCount(0);
      await category("quartermaster", "Quartermaster / Bo’sun").click();
      expect(await history()).toEqual(before);
      const reports = root().getByTestId("leader-nav-qm-reports");
      await expect(reports).toHaveAttribute("href", "/leader/qm-reports");
      await reports.click();
      await expect(page).toHaveURL(/\/leader\/qm-reports$/);
      await expect(page.getByTestId("qm-report-content")).toBeVisible();
      await page.reload();
      await expect(page.getByTestId("page-qm-reports")).toBeVisible();
      await trigger.click();
      for (const size of [{ width, height: 851 }, { width: 1000, height: 393 }, { width, height: 851 }]) {
        await page.setViewportSize(size);
        const visibleRoot = page.getByTestId(redesigned ? "leader-navigation-redesigned" : size.width >= 900 ? "leader-navigation-desktop" : "leader-navigation-mobile");
        await expect(visibleRoot).toBeVisible();
        await expect(visibleRoot.getByTestId("leader-nav-qm-reports")).toHaveAttribute("aria-current", "page");
        await expect(visibleRoot.locator('[aria-current="page"]')).toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const undersized = await nav.getByRole("button").or(nav.getByRole("link")).evaluateAll(elements => elements.filter(element => { const rect = element.getBoundingClientRect(); return rect.width < 44 || rect.height < 44; }).map(element => element.textContent));
        expect(undersized).toEqual([]);
        if (redesigned || size.width < 900) await expect(category("quartermaster", "Quartermaster / Bo’sun")).toHaveAttribute("aria-expanded", "true");
      }
      await page.goBack();
      await expect(nav).toBeHidden();
      await expect(page).toHaveURL(/\/leader\/qm-reports$/);
      await expect(page.getByTestId("qm-report-content")).toBeVisible();
      await page.getByRole("link", { name: "Back to Equipment & Stores", exact: true }).click();
      await expect(page).toHaveURL(/\/leader\/equipment\?view=quartermaster$/);
      await expect(page.getByTestId("page-qm-equipment-stores")).toBeVisible();
    } finally { await mode(page, false); }
  });
}
