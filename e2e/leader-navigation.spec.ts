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
  await page.goto("/leader/weekly");
  const menuToggle = page.getByRole("button", { name: /Leader Menu|Menu ·/ });
  await menuToggle.click();

  const navigation = page.getByRole("navigation", { name: "Leader navigation" });
  const desktopNavigation = navigation.getByTestId("leader-navigation-desktop");
  const desktopGroups = desktopNavigation.locator(".MuiTypography-overline");
  await expect(desktopGroups.filter({ hasText: /^Programme$/ })).toBeVisible();
  await expect(desktopGroups.filter({ hasText: /^People & Parents$/ })).toBeVisible();
  await expect(desktopGroups.filter({ hasText: /^Group Operations$/ })).toBeVisible();
  await expect(desktopGroups.filter({ hasText: /^Insights & Records$/ })).toBeVisible();
  await expect(desktopGroups.filter({ hasText: /^Administration$/ })).toBeVisible();
  await expect(navigation.getByText("Account & Help", { exact: true })).toBeVisible();

  await expect(desktopNavigation.getByRole("link", { name: "Weekly Meetings" })).toHaveAttribute("href", "/leader/weekly");
  await expect(desktopNavigation.getByRole("link", { name: "Section Floats" })).toHaveAttribute("href", "/leader/finance");
  await expect(desktopNavigation.getByRole("link", { name: "Leader Access" })).toHaveAttribute("href", "/leader/access");
  await expect(navigation.getByRole("link", { name: "Info & FAQ" })).toHaveAttribute("href", "/leader/info");
  const dashboard = navigation.getByRole("link", { name: "Dashboard", exact: true });
  await expect(dashboard).toHaveCount(1);
  await dashboard.click();
  await expect(page).toHaveURL(/\/leader$/);
});

test("section leader gets compact mobile disclosure without admin destinations", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile disclosure regression runs once on Pixel 7 Chromium.");
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page, leaderEmail!);
  await page.getByRole("button", { name: /Leader Menu|Menu ·/ }).click();

  const navigation = page.getByRole("navigation", { name: "Leader navigation" });
  const mobileNavigation = navigation.getByTestId("leader-navigation-mobile");
  const programme = mobileNavigation.getByRole("button", { name: "Programme" });
  const people = mobileNavigation.getByRole("button", { name: "People & Parents" });
  await expect(navigation.getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(1);

  await expect(programme).toHaveAttribute("aria-expanded", "false");
  await expect(people).toHaveAttribute("aria-expanded", "false");
  await expect(mobileNavigation.getByRole("region", { name: "Programme" })).toHaveCount(0);

  await programme.click();
  await expect(programme).toHaveAttribute("aria-expanded", "true");
  await expect(mobileNavigation.getByRole("region", { name: "Programme" })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Weekly Meetings" })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Member Management" })).toHaveCount(0);
  await expect(mobileNavigation.getByRole("button", { name: "Administration" })).toHaveCount(0);
  await expect(mobileNavigation.getByRole("link", { name: "Leader Access" })).toHaveCount(0);

  await people.click();
  await expect(people).toHaveAttribute("aria-expanded", "true");
  await expect(programme).toHaveAttribute("aria-expanded", "false");
  await expect(mobileNavigation.getByRole("region", { name: "People & Parents" })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Member Management" })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Weekly Meetings" })).toHaveCount(0);

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
  const mobileNavigation = navigation.getByTestId("leader-navigation-mobile");
  const programme = mobileNavigation.getByRole("button", { name: "Programme" });
  const people = mobileNavigation.getByRole("button", { name: "People & Parents" });

  await expect(people).toHaveAttribute("aria-expanded", "true");
  await expect(programme).toHaveAttribute("aria-expanded", "false");
  await expect(mobileNavigation.getByRole("link", { name: "Member Management" })).toBeVisible();
  await expect(mobileNavigation.getByRole("link", { name: "Member Management" })).toHaveAttribute("aria-current", "page");
  const dashboard = navigation.getByRole("link", { name: "Dashboard", exact: true });
  await expect(dashboard).toHaveCount(1);
  await dashboard.click();
  await expect(page).toHaveURL(/\/leader$/);
});

test("Leader Menu supports keyboard open and Escape focus restoration", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Keyboard navigation regression runs once on Chromium.");
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page, leaderEmail!);
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

  const menuToggle = page.getByRole("button", { name: /Leader Menu|Menu ·/ });
  await menuToggle.focus();
  await page.keyboard.press("Enter");
  await expect(menuToggle).toHaveAttribute("aria-expanded", "true");

  const navigation = page.getByRole("navigation", { name: "Leader navigation" });
  const weeklyMeetings = navigation.getByTestId("leader-navigation-desktop").getByRole("link", { name: "Weekly Meetings" });
  await expect(weeklyMeetings).toHaveAttribute("aria-current", "page");
  await weeklyMeetings.focus();
  await page.keyboard.press("Escape");

  await expect(navigation).toHaveCount(0);
  await expect(menuToggle).toBeFocused();
  await expect(menuToggle).toHaveAttribute("aria-expanded", "false");
});
