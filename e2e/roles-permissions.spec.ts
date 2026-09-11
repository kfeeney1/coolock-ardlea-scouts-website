import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Credentials = { email: string; password: string };

function credentials(prefix: string): Credentials | null {
  const email = process.env[`${prefix}_EMAIL`]?.trim();
  const password = process.env[`${prefix}_PASSWORD`] || process.env.E2E_TEST_USER_PASSWORD;
  return email && password ? { email, password } : null;
}

function seededCredentials(email: string): Credentials | null {
  const password = process.env.E2E_TEST_USER_PASSWORD;
  return password ? { email, password } : null;
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
    await expect(page.getByText(/security-protected and code-defined/i)).toBeVisible();
    await expect(page.getByTestId("role-administration")).toContainText("Role assignment and permission configuration are intentionally separate");
    await expect(page.getByTestId("role-administration")).toContainText("cannot change role or appointment assignments");
    await expect(page.getByTestId("role-administration").getByRole("link", { name: "Manage user roles & appointments" })).toHaveCount(0);
    await expect(page.getByTestId("effective-permissions")).toContainText("leader");
    await expect(page.getByTestId("permission-members.read.section")).toContainText("Effective for you");
    await expect(page.getByTestId("permission-roles.manage.admin")).toContainText("Not granted");
    await expect(page.getByText("System access roles", { exact: true })).toBeVisible();
    await expect(page.getByText("Scouting appointments", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  });
});

test.describe("Deputy Group Leader parity", () => {
  const account = seededCredentials("test.deputy.group.leader@example.com");

  test("Deputy Group Leader receives the Group Leader operational bundle without Admin authority", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Deputy parity security journey runs once on desktop Chromium.");
    test.skip(!account, "Configure the canonical E2E password.");
    await loginLeader(page, account!);
    await page.goto("/leader/roles");

    await expect(page.getByTestId("effective-permissions")).toContainText("Deputy Group Leader");
    for (const permission of [
      "members.read.group",
      "weekly-meetings.manage.group",
      "programme.manage.group",
      "badgework.manage.group",
      "finance.manage.group",
      "equipment.manage",
      "audit.read",
      "settings.subs.manage"
    ]) {
      await expect(page.getByTestId(`permission-${permission}`)).toContainText("Effective for you");
    }
    await expect(page.getByTestId("permission-roles.manage.admin")).toContainText("Not granted");
    await expect(page.getByTestId("permission-system.superadmin.protect")).toContainText("Not granted");
    await expect(page.getByTestId("role-administration")).toContainText("cannot change activation or any system role");
    await expect(page.getByTestId("role-administration").getByRole("link", { name: "Manage user roles & appointments" })).toBeVisible();

    await page.goto("/leader/activity");
    await expect(page.getByRole("heading", { name: "Activity Log" })).toBeVisible();
    await page.goto("/leader/settings");
    await expect(page.getByTestId("subs-settings-panel")).toBeVisible();
    await page.goto("/leader/access");
    await expect(page.getByRole("heading", { name: "Leader Access & Organisation" })).toBeVisible();
    await expect(page.getByText(/System access roles remain Super Admin-only/i)).toBeVisible();
  });

  test("Deputy Group Leader has usable mobile Roles and Leader Access navigation", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Deputy mobile parity runs once on mobile Chromium.");
    test.skip(!account, "Configure the canonical E2E password.");
    await loginLeader(page, account!);
    await page.goto("/leader/roles");
    await expect(page.getByRole("heading", { name: "Roles & Permissions" })).toBeVisible();
    await expect(page.getByTestId("role-administration").getByRole("link", { name: "Manage user roles & appointments" })).toBeVisible();
    await page.getByRole("button", { name: /Leader Menu|Menu ·/ }).click();
    const navigation = page.getByRole("navigation", { name: "Leader navigation" });
    const administration = navigation.getByTestId("leader-navigation-mobile").getByRole("button", { name: "Administration" });
    await administration.click();
    await expect(navigation.getByRole("link", { name: "Roles & Permissions" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Settings" })).toBeVisible();
    await expect(navigation.getByRole("link", { name: "Leader Access" })).toBeVisible();
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
    await expect(page.getByTestId("role-administration")).toContainText("cannot grant Admin or Super Admin system access");
    await expect(page.getByTestId("role-administration").getByRole("link", { name: "Manage user roles & appointments" })).toBeVisible();
  });
});

test.describe("super-admin roles catalogue", () => {
  const account = credentials("E2E_SUPER_ADMIN");

  test("Super Admin receives the complete protected administrative and operational bundle", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Authenticated Super Admin security journey runs once on desktop Chromium.");
    test.skip(!account, "Configure the seeded E2E Super Admin account.");
    await loginLeader(page, account!);
    await page.goto("/leader/roles");

    await expect(page.getByTestId("system-role-matrix")).toContainText("Super Admin");
    await expect(page.getByTestId("system-role-matrix")).toContainText("Protected");
    await expect(page.getByTestId("role-administration")).toContainText("Protected Super Admin accounts cannot be altered");
    await expect(page.getByTestId("role-administration").getByRole("link", { name: "Manage user roles & appointments" })).toBeVisible();

    for (const permission of [
      "members.read.group",
      "weekly-meetings.manage.group",
      "meeting-records.read.group",
      "programme.manage.group",
      "event-gallery.manage.group",
      "badgework.manage.group",
      "badgework.read.group",
      "finance.manage.group",
      "equipment.manage",
      "audit.read",
      "roles.delegate.operational",
      "roles.manage.operational",
      "roles.manage.admin",
      "settings.session.manage",
      "settings.subs.manage",
      "system.superadmin.protect"
    ]) {
      await expect(page.getByTestId(`permission-${permission}`)).toContainText("Effective for you");
    }

    await expect(page.getByTestId("permission-members.read.linked")).toContainText("Not granted");
    await expect(page.getByTestId("permission-badgework.read.linked")).toContainText("Not granted");
  });

  test("Super Admin role administration remains usable on Pixel 7/mobile", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Super Admin mobile role administration runs once on mobile Chromium.");
    test.skip(!account, "Configure the seeded E2E Super Admin account.");
    await loginLeader(page, account!);
    await page.goto("/leader/roles");
    await expect(page.getByTestId("role-administration").getByRole("link", { name: "Manage user roles & appointments" })).toBeVisible();
    await expect(page.getByTestId("permission-roles.manage.admin")).toContainText("Effective for you");
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
  });
});
