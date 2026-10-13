import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com";
const parentEmail = process.env.E2E_PARENT_EMAIL || "test.beaver.parent1@example.com";

async function loginSuperAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(superAdminEmail);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function expectPublicParentLogin(page: Page, visible: boolean, testInfo: TestInfo) {
  await page.goto("/");
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    const parentLogin = page.getByRole("menuitem", { name: "Parent Login", exact: true });
    if (visible) {
      await expect(parentLogin).toBeVisible();
      await expect(parentLogin).toHaveAttribute("href", "/parent");
    } else {
      await expect(parentLogin).toHaveCount(0);
    }
  } else {
    const parentLogin = page.getByRole("banner").getByRole("link", { name: "Parent Login", exact: true });
    if (visible) {
      await expect(parentLogin).toBeVisible();
      await expect(parentLogin).toHaveAttribute("href", "/parent");
    } else {
      await expect(parentLogin).toHaveCount(0);
    }
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
}

test("Super Admin can persist Parent Login visibility without changing portal access", async ({ page, browser }, testInfo) => {
  test.skip(!password, "Configure the canonical E2E password.");
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Parent Login visibility is checked on desktop and mobile Chromium.");

  await loginSuperAdmin(page);
  await page.goto("/leader/settings");
  const setting = page.getByRole("switch", { name: "Enable Parent Login" });
  await expect(setting).toBeVisible();
  await expect(setting).toBeChecked();

  const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
  const publicContext = await browser.newContext({ baseURL });
  const publicPage = await publicContext.newPage();
  const parentContext = await browser.newContext({ baseURL });
  const parentPage = await parentContext.newPage();
  if (testInfo.project.name === "mobile-chromium") await publicPage.setViewportSize({ width: 390, height: 844 });
  if (testInfo.project.name === "mobile-chromium") await parentPage.setViewportSize({ width: 390, height: 844 });

  try {
    await setting.click();
    await expect(page.getByRole("status")).toContainText("Parent Login disabled");
    await expect(setting).not.toBeChecked();

    await expectPublicParentLogin(publicPage, false, testInfo);

    // The setting controls public navigation. Existing direct links still reach
    // the canonical flow, whose protected data remains behind its normal checks.
    await publicPage.goto("/parent?joinToken=SW385-invitation-test");
    await expect(publicPage.getByRole("heading", { name: "Parent Portal" })).toBeVisible();
    await expect(publicPage.getByRole("button", { name: "Forgot Password?" })).toBeVisible();
    await publicPage.getByRole("button", { name: "Need an account? Register" }).click();
    await expect(publicPage.getByText(/Use the parent email that received the acceptance message/)).toBeVisible();

    // A public-navigation preference must not prevent use of the canonical
    // Parent Portal flow through a direct route while the entry point is off.
    await parentPage.goto("/parent");
    await parentPage.getByLabel("Email").fill(parentEmail);
    await parentPage.getByLabel("Password").fill(password!);
    await parentPage.getByRole("button", { name: "Sign In" }).click();
    await expect(parentPage.getByRole("heading", { name: "Parent Portal", exact: true })).toBeVisible();
    await expect(parentPage.getByRole("navigation", { name: "Parent Portal sections" })).toBeVisible();

    // A new signed-out browser context reads the same persisted configuration.
    const freshContext = await browser.newContext({ baseURL });
    const freshPage = await freshContext.newPage();
    if (testInfo.project.name === "mobile-chromium") await freshPage.setViewportSize({ width: 390, height: 844 });
    try {
      await expectPublicParentLogin(freshPage, false, testInfo);
    } finally {
      await freshContext.close();
    }

    await setting.click();
    await expect(page.getByRole("status")).toContainText("Parent Login enabled");
    await expect(setting).toBeChecked();
    await expectPublicParentLogin(publicPage, true, testInfo);

    // Authenticated parents continue to reach the same canonical route after
    // the navigation setting is re-enabled; role and relationship checks stay
    // owned by the existing Parent Portal implementation.
    await publicPage.goto("/parent");
    await publicPage.getByLabel("Email").fill(parentEmail);
    await publicPage.getByLabel("Password").fill(password!);
    await publicPage.getByRole("button", { name: "Sign In" }).click();
    await expect(publicPage.getByRole("heading", { name: "Parent Portal" })).toBeVisible();
  } finally {
    if (!(await setting.isChecked().catch(() => true))) {
      await setting.click();
      await expect(page.getByRole("status")).toContainText("Parent Login enabled");
    }
    await parentContext.close();
    await publicContext.close();
  }
});
