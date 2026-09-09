import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Credentials = { email: string; password: string };

function credentials(prefix: string): Credentials | null {
  const email = process.env[`${prefix}_EMAIL`]?.trim();
  const password = process.env[`${prefix}_PASSWORD`] || process.env.E2E_TEST_USER_PASSWORD;
  return email && password ? { email, password } : null;
}

async function loginLeader(page: Page, account: Credentials) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

function chromiumOnly(testInfo: TestInfo) {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Roles catalogue is covered on desktop and mobile Chromium.");
}

test("Roles & Permissions rejects unauthenticated access", async ({ page }) => {
  await page.goto("/leader/roles");
  await expect(page).toHaveURL(/\/leader\/login$/);
});

test.describe("leader roles catalogue", () => {
  const account = credentials("E2E_LEADER");

  test("ordinary leader can read the honest permission catalogue and effective summary", async ({ page }, testInfo) => {
    chromiumOnly(testInfo);
    test.skip(!account, "Configure the seeded E2E leader account.");
    await loginLeader(page, account!);
    await page.goto("/leader/roles");

    await expect(page.getByRole("heading", { name: "Roles & Permissions" })).toBeVisible();
    await expect(page.getByText(/Permissions are currently code-defined/i)).toBeVisible();
    await expect(page.getByTestId("effective-permissions")).toContainText("leader");
    await expect(page.getByTestId("permission-members.read.section")).toContainText("Effective for you");
    await expect(page.getByTestId("permission-roles.manage.admin")).toContainText("Not granted");
    await expect(page.getByText("System access roles", { exact: true })).toBeVisible();
    await expect(page.getByText("Scouting appointments", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  });
});

test.describe("admin roles catalogue", () => {
  const account = credentials("E2E_ADMIN");

  test("Admin sees ordinary role management but not Super Admin promotion authority", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Authenticated admin check runs once on desktop Chromium.");
    test.skip(!account, "Configure the seeded E2E admin account.");
    await loginLeader(page, account!);
    await page.goto("/leader/roles");
    await expect(page.getByTestId("permission-roles.manage.operational")).toContainText("Effective for you");
    await expect(page.getByTestId("permission-roles.manage.admin")).toContainText("Not granted");
  });
});

test.describe("super-admin roles catalogue", () => {
  const account = credentials("E2E_SUPER_ADMIN");

  test("Super Admin sees protected Admin-promotion authority", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Authenticated Super Admin check runs once on desktop Chromium.");
    test.skip(!account, "Configure the seeded E2E Super Admin account.");
    await loginLeader(page, account!);
    await page.goto("/leader/roles");
    await expect(page.getByTestId("permission-roles.manage.admin")).toContainText("Effective for you");
    await expect(page.getByTestId("permission-system.superadmin.protect")).toContainText("Effective for you");
  });
});
