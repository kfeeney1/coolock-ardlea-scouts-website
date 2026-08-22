import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Credentials = { email: string; password: string };

const protectedLeaderRoutes = [
  "/leader",
  "/leader/requests",
  "/leader/access",
  "/leader/profile",
  "/leader/reports",
  "/leader/attendance",
  "/leader/consents",
  "/leader/info",
  "/leader/join",
  "/leader/members",
  "/leader/member-history",
  "/leader/events",
  "/leader/event-consent",
  "/leader/parent-access"
];

function credentials(prefix: string): Credentials | null {
  const email = process.env[`${prefix}_EMAIL`]?.trim();
  const password = process.env[`${prefix}_PASSWORD`] || process.env.E2E_TEST_USER_PASSWORD;
  return email && password ? { email, password } : null;
}

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Authenticated role checks run once on desktop Chromium.");
}

async function loginLeader(page: Page, account: Credentials) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function loginParent(page: Page, account: Credentials) {
  await page.goto("/parent");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText("Parent Consent Portal").first()).toBeVisible();
}

test.describe("route protection", () => {
  for (const route of protectedLeaderRoutes) {
    test(`${route} rejects unauthenticated users`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/leader\/login$/);
      await expect(page.getByRole("heading", { name: "Leader Login" })).toBeVisible();
    });
  }
});

test.describe("parent-only permissions", () => {
  const account = credentials("E2E_PARENT");
  test("parent can use Parent Portal but is redirected away from Leader Dashboard", async ({ page }, testInfo) => {
    desktopOnly(testInfo); test.skip(!account, "Configure the seeded E2E test password to run this check.");
    await loginParent(page, account!);
    await expect(page.getByRole("link", { name: "Request Leader Access" })).toBeVisible();
    await page.goto("/leader");
    await expect(page).toHaveURL(/\/parent$/);
  });
});

test.describe("leader permissions", () => {
  const account = credentials("E2E_LEADER");
  test("ordinary leader can open scoped attendance insights", async ({ page }, testInfo) => {
    desktopOnly(testInfo); test.skip(!account, "Configure the seeded E2E test password to run this check.");
    await loginLeader(page, account!);
    await expect(page.getByRole("link", { name: "Attendance Insights" })).toBeVisible();
    await page.getByRole("link", { name: "Attendance Insights" }).click();
    await expect(page).toHaveURL(/\/leader\/attendance$/);
    await expect(page.getByRole("heading", { name: "Attendance History & Insights" })).toBeVisible();
    await expect(page.getByText(/Scope:/)).toContainText("Scouts");
    await expect(page.getByRole("link", { name: "Leader Access" })).toHaveCount(0);
  });
});
