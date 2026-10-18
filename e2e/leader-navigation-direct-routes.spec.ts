import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;

async function selectVersion(page: Page, redesigned: boolean) {
  await page.goto("/leader/settings");
  const choice = page.getByRole("button", { name: `${redesigned ? "Redesigned" : "Existing"} navigation`, exact: true });
  await expect(choice).toBeEnabled();
  if (await choice.getAttribute("aria-pressed") !== "true") await choice.click();
  await expect(choice).toHaveAttribute("aria-pressed", "true");
}

async function activeDestination(page: Page, redesigned: boolean, mobile: boolean, id: string, category: string, label: string) {
  const toggle = page.locator('button[aria-controls="leader-navigation"]');
  await toggle.click();
  const root = page.getByTestId(redesigned ? "leader-navigation-redesigned" : mobile ? "leader-navigation-mobile" : "leader-navigation-desktop");
  await expect(root).toBeVisible();
  if (redesigned || mobile) {
    const parent = redesigned ? root.locator(`button[aria-controls="redesigned-${category}-panel"]`) : root.getByRole("button", { name: label, exact: true });
    // The route must expand its own parent; the test never expands it.
    await expect(parent).toHaveAttribute("aria-expanded", "true");
    await expect(root.locator('button[aria-expanded="true"]')).toHaveCount(1);
  }
  await expect(root.getByTestId(`leader-nav-${id}`)).toBeVisible();
  await expect(root.getByTestId(`leader-nav-${id}`)).toHaveAttribute("aria-current", "page");
  await expect(root.locator('[aria-current="page"]')).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation", { name: "Leader navigation", exact: true })).toBeHidden();
}

for (const redesigned of [false, true]) {
  test.describe(`${redesigned ? "Redesigned" : "Existing"} direct-route boundaries`, () => {
    test.beforeEach(async ({ page }) => {
      test.skip(!password, "Configure canonical E2E credentials.");
      await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
      await selectVersion(page, redesigned);
      // Real Sign Out keeps the representative account's session independent.
      await page.locator('button[aria-controls="leader-navigation"]').click();
      await page.getByRole("button", { name: "Sign Out", exact: true }).click();
      await expect(page).toHaveURL(/\/leader\/login$/);
    });
    test.afterEach(async ({ browser, baseURL }) => {
      if (!password) return;
      const context = await browser.newContext({ baseURL });
      try {
        const settings = await context.newPage();
        await loginAsLeader(settings, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password });
        await selectVersion(settings, false);
      } finally { await context.close(); }
    });

    test("Programme deep links retain member scope after reload", async ({ page, baseURL }, testInfo) => {
      await loginAsLeader(page, { email: "test.scout.programme.scouter@example.com", password: password! });
      const allowed = "/leader/members/TEST_member_scout_01";
      await page.goto(allowed);
      for (const reload of [false, true]) {
        if (reload) await page.reload();
        await expect(page).toHaveURL(new URL(allowed, baseURL).href);
        await expect(page.getByRole("heading", { name: "Casey OBrien Scouts 01", exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Member Details", exact: true })).toBeVisible();
        await activeDestination(page, redesigned, testInfo.project.name === "mobile-chromium", "member-management", "people-parents", "People & Parents");
      }
      const denied = "/leader/members/TEST_member_beaver_01";
      await page.goto(denied);
      for (const reload of [false, true]) {
        if (reload) await page.reload();
        await expect(page).toHaveURL(new URL(denied, baseURL).href);
        await expect(page.getByText("This member record is unavailable or outside your assigned sections.", { exact: true })).toBeVisible();
        await expect(page.getByRole("heading", { name: "Riley Nolan Beavers 01", exact: true, includeHidden: true })).toHaveCount(0);
        await expect(page.getByRole("heading", { name: "Member Details", exact: true, includeHidden: true })).toHaveCount(0);
      }
    });

    test("Bosun filtered deep link cannot open Treasurer settings", async ({ page, baseURL }, testInfo) => {
      await loginAsLeader(page, { email: "test.group.quartermaster@example.com", password: password! });
      const allowed = "/leader/settings?section=Cubs&view=quartermaster";
      await page.goto(allowed);
      for (const reload of [false, true]) {
        if (reload) await page.reload();
        await expect(page).toHaveURL(new URL(allowed, baseURL).href);
        await expect(page.getByTestId("page-qm-settings")).toBeVisible();
        await activeDestination(page, redesigned, testInfo.project.name === "mobile-chromium", "qm-settings", "quartermaster", "Quartermaster / Bo’sun");
        await expect(page.getByTestId("page-treasurer-settings")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Redesigned navigation", exact: true, includeHidden: true })).toHaveCount(0);
      }
      await page.goto("/leader/settings?section=Cubs&view=treasurer");
      await expect(page).toHaveURL(/\/leader$/);
      await expect(page.getByTestId("admin-overview")).toBeVisible();
      await expect(page.getByTestId("page-treasurer-settings")).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId("admin-overview")).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(new URL(allowed, baseURL).href);
      await expect(page.getByTestId("page-qm-settings")).toBeVisible();
    });

    test("Secretary saved-link redirect restores identity without exposing System Information", async ({ page, baseURL }, testInfo) => {
      await loginAsLeader(page, { email: "test.group.secretary@example.com", password: password! });
      await page.goto("/leader/member-history");
      for (const reload of [false, true]) {
        if (reload) await page.reload();
        await expect(page).toHaveURL(new URL("/leader/members", baseURL).href);
        await expect(page.getByTestId("page-member-management")).toBeVisible();
        await activeDestination(page, redesigned, testInfo.project.name === "mobile-chromium", "member-management", "people-parents", "People & Parents");
      }
      await page.goto("/leader/system");
      await expect(page).toHaveURL(/\/leader$/);
      await expect(page.getByTestId("admin-overview")).toBeVisible();
      await expect(page.getByRole("heading", { name: "System Information", exact: true, includeHidden: true })).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId("admin-overview")).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(new URL("/leader/members", baseURL).href);
      await expect(page.getByTestId("page-member-management")).toBeVisible();
    });
  });
}
