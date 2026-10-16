import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
const parentEmail = process.env.E2E_PARENT_EMAIL;
const combinedEmail = process.env.E2E_PARENT_LEADER_EMAIL;

test.beforeEach(({ page }, testInfo) => {
  void page;
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Login landing behavior runs on desktop and mobile Chromium.");
  test.skip(!password, "Configure canonical E2E credentials.");
});

async function signInLeader(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}

async function signInParent(page: Page, email: string) {
  await page.goto("/parent");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
}

async function signOutLeader(page: Page, testInfo: TestInfo) {
  await page.getByRole("button", { name: /Leader Menu|Menu ·/ }).click();
  await page.getByRole("navigation", { name: "Leader navigation" }).getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/login$/);
  if (testInfo.project.name === "mobile-chromium") {
    await expect(page.getByRole("heading", { name: "Leader Login", exact: true })).toBeVisible();
  }
}

test("standard leader login lands on the Leader Dashboard", async ({ page }) => {
  test.skip(!leaderEmail, "Configure the canonical leader account.");
  await signInLeader(page, leaderEmail!);
  await expect(page).toHaveURL(/\/leader$/);
  await expect(page.getByRole("heading", { name: "Leader Dashboard", exact: true })).toBeVisible();
});

test("standard parent-only login lands on the Parent Portal home", async ({ page }) => {
  test.skip(!parentEmail, "Configure the canonical parent account.");
  await signInParent(page, parentEmail!);
  await expect(page).toHaveURL(/\/parent(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: "Parent Portal", exact: true })).toBeVisible();
  await expect(page.getByText(/Your account is approved and linked to/)).toBeVisible();
});

test("combined account lands in Leader context and can switch to Parent Portal", async ({ page }) => {
  test.skip(!combinedEmail, "Configure the canonical combined parent/leader account.");
  await signInLeader(page, combinedEmail!);
  await expect(page).toHaveURL(/\/leader$/);
  await expect(page.getByRole("heading", { name: "Leader Dashboard", exact: true })).toBeVisible();

  await page.getByRole("button", { name: /Leader Menu|Menu ·/ }).click();
  await page.getByRole("navigation", { name: "Leader navigation" }).getByRole("link", { name: "View Parent Portal ↗", exact: true }).click();
  await expect(page).toHaveURL(/\/parent(?:\?.*)?$/);
  await expect(page.getByRole("heading", { name: "Parent Portal", exact: true })).toBeVisible();
});

test("signing out from a deep route and signing in again starts at the dashboard", async ({ page }, testInfo) => {
  test.skip(!leaderEmail, "Configure the canonical leader account.");
  await signInLeader(page, leaderEmail!);
  await expect(page.getByRole("heading", { name: "Leader Dashboard", exact: true })).toBeVisible();
  await page.goto("/leader/members");
  await expect(page.getByRole("heading", { name: "Member Management", exact: true })).toBeVisible();

  await signOutLeader(page, testInfo);
  await signInLeader(page, leaderEmail!);
  await expect(page).toHaveURL(/\/leader$/);
  await expect(page.getByRole("heading", { name: "Leader Dashboard", exact: true })).toBeVisible();
});

test("an expired session followed by login starts at the dashboard", async ({ page }) => {
  test.skip(!leaderEmail, "Configure the canonical leader account.");
  await signInLeader(page, leaderEmail!);
  await page.goto("/leader/members");
  await expect(page.getByRole("heading", { name: "Member Management", exact: true })).toBeVisible();

  await page.evaluate(() => {
    window.localStorage.setItem("scout-session-last-activity", "1");
    window.dispatchEvent(new Event("focus"));
  });
  await expect(page).toHaveURL(/\/leader\/login$/);
  await signInLeader(page, leaderEmail!);
  await expect(page).toHaveURL(/\/leader$/);
  await expect(page.getByRole("heading", { name: "Leader Dashboard", exact: true })).toBeVisible();
});

test("a fresh authenticated deep link still returns to its requested page", async ({ page }) => {
  test.skip(!leaderEmail, "Configure the canonical leader account.");
  await page.goto("/leader/members");
  await expect(page).toHaveURL(/\/leader\/login$/);
  await signInLeader(page, leaderEmail!);
  await expect(page).toHaveURL(/\/leader\/members$/);
  await expect(page.getByRole("heading", { name: "Member Management", exact: true })).toBeVisible();
});

test("parent invitation and password recovery remain on their intended flows", async ({ page }) => {
  test.skip(!parentEmail, "Configure the canonical parent account.");
  await page.goto("/parent?joinToken=SW404-invitation-regression");
  await expect(page).toHaveURL(/\/parent\?joinToken=SW404-invitation-regression$/);
  await expect(page.getByRole("heading", { name: "Parent Portal", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();

  await page.getByLabel("Email", { exact: true }).fill(parentEmail!);
  await page.getByRole("button", { name: "Forgot Password?", exact: true }).click();
  await expect(page.getByText(/password-reset email will be sent/i)).toBeVisible();
  await expect(page).toHaveURL(/\/parent\?joinToken=SW404-invitation-regression$/);
});

test("leader password recovery stays on the login flow", async ({ page }) => {
  test.skip(!leaderEmail, "Configure the canonical leader account.");
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(leaderEmail!);
  await page.getByRole("button", { name: "Forgot Password?", exact: true }).click();
  await expect(page.getByText(/password-reset email will be sent/i)).toBeVisible();
  await expect(page).toHaveURL(/\/leader\/login$/);
});
