import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("admin sees grouped desktop navigation with administration tools", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop navigation regression runs once on Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await login(page, "test.webadmin@example.com");
  const menuToggle = page.getByRole("button", { name: /Leader Menu|Menu ·/ });
  await menuToggle.click();

  const navigation = page.getByRole("navigation", { name: "Leader navigation" });
  const desktopGroups = navigation.locator(".MuiTypography-overline");
  await expect(desktopGroups.filter({ hasText: /^Programme$/ })).toBeVisible();
  await expect(desktopGroups.filter({ hasText: /^People & Parents$/ })).toBeVisible();
  await expect(desktopGroups.filter({ hasText: /^Group Operations$/ })).toBeVisible();
  await expect(desktopGroups.filter({ hasText: /^Insights & Records$/ })).toBeVisible();
  await expect(desktopGroups.filter({ hasText: /^Administration$/ })).toBeVisible();
  await expect(desktopGroups.filter({ hasText: /^Account & Help$/ })).toBeVisible();

  await expect(navigation.getByRole("link", { name: "Weekly Meetings" })).toHaveAttribute("href", "/leader/weekly");
  await expect(navigation.getByRole("link", { name: "Section Floats" })).toHaveAttribute("href", "/leader/finance");
  await expect(navigation.getByRole("link", { name: "Leader Access" })).toHaveAttribute("href", "/leader/access");
  await expect(navigation.getByRole("link", { name: "Info & FAQ" })).toHaveAttribute("href", "/leader/info");
});

test("section leader gets compact mobile disclosure without admin destinations", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile disclosure regression runs once on Pixel 7 Chromium.");
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page, leaderEmail!);
  await page.getByRole("button", { name: /Leader Menu|Menu ·/ }).click();

  const navigation = page.getByRole("navigation", { name: "Leader navigation" });
  const programme = navigation.getByRole("button", { name: "Programme" });
  const people = navigation.getByRole("button", { name: "People & Parents" });

  await expect(programme).toHaveAttribute("aria-expanded", "true");
  await expect(people).toHaveAttribute("aria-expanded", "false");
  await expect(navigation.getByRole("link", { name: "Weekly Meetings" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Member Management" })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: "Administration" })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "Leader Access" })).toHaveCount(0);

  await people.click();
  await expect(people).toHaveAttribute("aria-expanded", "true");
  await expect(programme).toHaveAttribute("aria-expanded", "false");
  await expect(navigation.getByRole("link", { name: "Member Management" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Weekly Meetings" })).toHaveCount(0);

  await expect(navigation.getByRole("link", { name: "My Profile" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "Info & FAQ" })).toBeVisible();
  await expect(navigation.getByRole("link", { name: "View Parent Portal ↗" })).toBeVisible();
  await expect(navigation.getByRole("button", { name: "Sign Out" })).toBeVisible();
});

test("mobile menu reopens the group containing the current route", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Route-aware disclosure regression runs once on Pixel 7 Chromium.");
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page, leaderEmail!);
  await page.goto("/leader/members");
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

  await page.getByRole("button", { name: /Leader Menu|Menu ·/ }).click();
  const navigation = page.getByRole("navigation", { name: "Leader navigation" });
  const programme = navigation.getByRole("button", { name: "Programme" });
  const people = navigation.getByRole("button", { name: "People & Parents" });

  await expect(people).toHaveAttribute("aria-expanded", "true");
  await expect(programme).toHaveAttribute("aria-expanded", "false");
  await expect(navigation.getByRole("link", { name: "Member Management" })).toBeVisible();
});
