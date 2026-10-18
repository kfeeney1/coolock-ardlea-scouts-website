import { expect, test, type Locator, type Page } from "@playwright/test";
import axe from "axe-core";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
const superEmail = process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com";
async function mode(page: Page, redesigned: boolean) {
  await page.goto("/leader/settings");
  const choice = page.getByRole("button", { name: `${redesigned ? "Redesigned" : "Existing"} navigation`, exact: true });
  await expect(choice).toBeEnabled();
  if (await choice.getAttribute("aria-pressed") !== "true") await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
}
async function tabTo(page: Page, target: Locator) {
  for (let count = 0; count < 60; count++) {
    if (await target.evaluate(element => element === document.activeElement)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
}
async function audit(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const result = await (window as unknown as { axe: typeof axe }).axe.run('[data-testid="leader-dashboard-header"]', {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "best-practice"] }
    });
    return result.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) }));
  });
  expect(violations).toEqual([]);
}
for (const redesigned of [false, true]) {
  test(`${redesigned ? "Redesigned" : "Existing"} menu supports keyboard selection, hidden panels, route focus and Escape`, async ({ page }, testInfo) => {
    test.skip(!password, "Configure canonical E2E credentials.");
    await loginAsLeader(page, { email: superEmail, password: password! });
    try {
      await mode(page, redesigned);
      await page.goto("/leader");
      await expect(page.getByTestId("admin-overview")).toBeVisible();
      const trigger = page.locator('button[aria-controls="leader-navigation"]');
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByRole("navigation", { name: "Leader navigation", exact: true })).toBeHidden();
      await tabTo(page, trigger);
      await page.keyboard.press("Enter");
      const nav = page.getByRole("navigation", { name: "Leader navigation", exact: true });
      await expect(nav).toBeVisible();
      const root = page.getByTestId(redesigned ? "leader-navigation-redesigned" : testInfo.project.name === "mobile-chromium" ? "leader-navigation-mobile" : "leader-navigation-desktop");
      if (redesigned || testInfo.project.name === "mobile-chromium") {
        const category = redesigned ? root.locator('button[aria-controls="redesigned-programme-panel"]') : root.getByRole("button", { name: "Programme", exact: true });
        await tabTo(page, category);
        const focus = await category.evaluate(element => ({ width: getComputedStyle(element).outlineWidth, style: getComputedStyle(element).outlineStyle }));
        if (redesigned) { expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(3); expect(focus.style).toBe("solid"); }
        await page.keyboard.press("Space");
        await expect(category).toHaveAttribute("aria-expanded", "true");
        await expect(root.getByRole("region")).toHaveCount(1);
        await page.keyboard.press("Tab");
        await expect(root.getByTestId("leader-nav-weekly-meetings")).toBeFocused();
        await expect(root.getByTestId("leader-nav-secretary-meeting-records")).toBeHidden();
      }
      const polls = root.getByTestId("leader-nav-group-polls");
      await tabTo(page, polls);
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL(/\/leader\/polls$/);
      await expect(page.getByRole("heading", { name: "Group Polls", exact: true, level: 1 })).toBeVisible();
      await expect(trigger).toBeFocused();
      await page.keyboard.press("Enter");
      await expect(nav).toBeVisible();
      await expect(root.getByTestId("leader-nav-group-polls")).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");
      await expect(nav).toBeHidden();
      await expect(trigger).toBeFocused();
    } finally { await mode(page, false); }
  });
}

for (const width of [393, 320]) test(`redesigned menu passes axe, relationships and touch targets at ${width}px`, async ({ page }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  await loginAsLeader(page, { email: superEmail, password: password! });
  try {
    await mode(page, true);
    await page.goto("/leader");
    const trigger = page.locator('button[aria-controls="leader-navigation"]');
    await trigger.click();
    const root = page.getByTestId("leader-navigation-redesigned");
    await expect(root).toBeVisible();
    await page.setViewportSize({ width, height: 851 });
      for (const group of ["programme", "secretary", "quartermaster", "super-admin"]) {
        const toggle = root.locator(`button[aria-controls="redesigned-${group}-panel"]`);
        if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
        await expect(root.getByRole("region")).toHaveCount(1);
        const broken = await root.locator("button[aria-controls]").evaluateAll(buttons => buttons.filter(button => !document.getElementById(button.getAttribute("aria-controls")!)).map(button => button.id));
        expect(broken).toEqual([]);
        const small = await page.getByRole("navigation", { name: "Leader navigation", exact: true }).getByRole("button").or(root.getByRole("link")).evaluateAll(elements => elements.filter(element => { const rect = element.getBoundingClientRect(); return rect.width < 44 || rect.height < 44; }).map(element => element.textContent));
        expect(small).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await audit(page);
      }
  } finally { await mode(page, false); }
});

test("restricted redesigned navigation exposes no Super Admin controls to the accessibility tree", async ({ browser, page, baseURL }, testInfo) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  await loginAsLeader(page, { email: superEmail, password: password! });
  let context;
  try {
    await mode(page, true);
    const mobile = testInfo.project.name === "mobile-chromium";
    context = await browser.newContext({ baseURL, viewport: page.viewportSize() ?? undefined, isMobile: mobile, hasTouch: mobile, userAgent: testInfo.project.use.userAgent });
    const restricted = await context.newPage();
    await loginAsLeader(restricted, { email: process.env.E2E_LEADER_EMAIL || "test.scout.programme.scouter@example.com", password: password! });
    await restricted.locator('button[aria-controls="leader-navigation"]').click();
    const root = restricted.getByTestId("leader-navigation-redesigned");
    await expect(root).toBeVisible();
    await expect(root.locator('[aria-controls="redesigned-super-admin-panel"]')).toHaveCount(0);
    await expect(root.getByTestId("leader-nav-system-information")).toHaveCount(0);
    await expect(root.getByRole("link", { name: "System Information", exact: true })).toHaveCount(0);
    await root.locator('button[aria-controls="redesigned-programme-panel"]').click();
    await audit(restricted);
  } finally { await context?.close(); await mode(page, false); }
});

test.describe("theme accessibility", () => {
  test.afterEach(async ({ page }) => {
    if (!password) return;
    const current = page.getByTestId("theme-menu").getByRole("button", { name: /^Current/ });
    if (await current.isVisible()) {
      await current.click();
      await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "default");
      await expect(current).toBeEnabled();
    }
    await mode(page, false);
  });
  for (const theme of [
    { id: "modern", label: "Modern Scout" },
    { id: "irish-adventure", label: "Irish Adventure" },
    { id: "uk-campaign", label: "Bold Campaign" },
    { id: "programme-led", label: "Programme Explorer" }
  ]) test(`redesigned navigation contrast and semantics in ${theme.id}`, async ({ page }) => {
    test.skip(!password, "Configure canonical E2E credentials.");
    await loginAsLeader(page, { email: superEmail, password: password! });
    await mode(page, true);
    await page.goto("/leader");
    await page.locator('button[aria-controls="leader-navigation"]').click();
    const themes = page.getByTestId("theme-menu");
    const choice = themes.getByRole("button", { name: new RegExp(`^${theme.label}`) });
    await choice.click();
    await expect(page.locator("html")).toHaveAttribute("data-ui-theme", theme.id);
    await expect(choice).toBeEnabled();
    await page.getByTestId("leader-navigation-redesigned").locator('button[aria-controls="redesigned-programme-panel"]').click();
    await audit(page);
  });
});
