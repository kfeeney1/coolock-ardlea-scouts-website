import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const modernEmail = process.env.E2E_MODERN_SUPER_ADMIN_EMAIL;

async function loginModern(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(modernEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "modern");
}

function chromiumOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Theme parity is exercised once in Chromium; shared functional journeys cover the browser matrix.");
}

test.describe("Modern Scout theme parity", () => {
  test.skip(!password || !modernEmail, "Configure the emulator-backed Modern Scout E2E identity.");

  test("keeps super-admin routes and navigation functionally identical on desktop", async ({ page }, testInfo) => {
    chromiumOnly(testInfo);
    await loginModern(page);

    await expect(page.getByRole("heading", { name: "Operations Overview" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Operational health" })).toBeVisible();

    const menuButton = page.getByRole("button", { name: /Open Leader Menu|Menu ·/ });
    await menuButton.click();
    const menu = page.locator("#leader-navigation");
    await expect(menu.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("href", "/leader");
    await expect(menu.getByRole("link", { name: "Info & FAQ" })).toHaveAttribute("href", "/leader/info");

    await page.keyboard.press("Escape");
    await page.goto("/leader/settings");
    await expect(page).toHaveURL(/\/leader\/settings$/);
    await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "modern");
    await expect(page.getByText(/Access denied|not authorised/i)).toHaveCount(0);
  });

  test("keeps Modern Scout responsive and usable on a phone viewport", async ({ page }, testInfo) => {
    chromiumOnly(testInfo);
    await page.setViewportSize({ width: 390, height: 844 });
    await loginModern(page);

    const menuButton = page.getByRole("button", { name: /Open Leader Menu|Menu ·/ });
    await menuButton.click();
    const menu = page.locator("#leader-navigation");
    const mobileNavigation = menu.getByTestId("leader-navigation-mobile");
    await expect(mobileNavigation).toBeVisible();
    await expect(menu.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();

    await mobileNavigation.getByRole("button", { name: "Account & Help" }).click();
    const infoLink = menu.getByRole("link", { name: "Info & FAQ" });
    await expect(infoLink).toBeVisible();
    await infoLink.click();

    await expect(page).toHaveURL(/\/leader\/info$/);
    await expect(page.locator("html")).toHaveAttribute("data-ui-theme", "modern");
    await expect(page.getByRole("heading", { name: "Leader Portal Information" })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
