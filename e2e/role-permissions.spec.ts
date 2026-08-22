import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Credentials = { email: string; password: string };

const protectedLeaderRoutes = [
  "/leader",
  "/leader/requests",
  "/leader/access",
  "/leader/profile",
  "/leader/reports",
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

async function openLeaderMenu(page: Page) {
  const button = page.getByRole("button", { name: /Leader Menu/ });
  await expect(button).toBeVisible();
  await button.click();
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
    desktopOnly(testInfo);
    test.skip(!account, "Configure the seeded E2E test password to run this check.");
    await loginParent(page, account!);

    await expect(page.getByRole("link", { name: "Request Leader Access" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toHaveCount(0);

    await page.goto("/leader");
    await expect(page).toHaveURL(/\/parent$/);
    await expect(page.getByText(/Parent access does not include Leader Dashboard access/i)).toBeVisible();
  });
});

test.describe("dual-role parent and leader permissions", () => {
  const account = credentials("E2E_PARENT_LEADER");

  test("same login exposes Parent Portal with full Leader Dashboard navigation", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!account, "Configure the seeded E2E test password to run this check.");
    await loginParent(page, account!);

    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
    await openLeaderMenu(page);
    await expect(page.getByRole("link", { name: "Member Management" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Member History" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Events & Activities" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reports & Exports" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Event Consent" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Parent Portal" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leader Access" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Parent Access" })).toHaveCount(0);

    await page.getByRole("link", { name: "Member Management" }).click();
    await expect(page).toHaveURL(/\/leader\/members$/);
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  });
});

test.describe("leader permissions", () => {
  const account = credentials("E2E_LEADER");

  test("ordinary leader sees operational areas but not admin-only navigation", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!account, "Configure the seeded E2E test password to run this check.");
    await loginLeader(page, account!);

    await openLeaderMenu(page);
    await expect(page.getByRole("link", { name: "Member Management" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Member History" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Events & Activities" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reports & Exports" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Event Consent" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leader Access" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Parent Access" })).toHaveCount(0);

    await page.getByRole("link", { name: "Member History" }).click();
    await expect(page).toHaveURL(/\/leader\/member-history$/);
    await expect(page.getByRole("heading", { name: "Member History" })).toBeVisible();

    await openLeaderMenu(page);
    await page.getByRole("link", { name: "Reports & Exports" }).click();
    await expect(page).toHaveURL(/\/leader\/reports$/);
    await expect(page.getByRole("heading", { name: "Reports & Exports" })).toBeVisible();
    await expect(page.getByText(/Report scope:/)).toContainText("Scouts");
    await expect(page.getByRole("button", { name: "Export Member CSV" })).toBeVisible();

    await page.goto("/leader/access");
    await expect(page.getByText("Administrator access is required.")).toBeVisible();
  });
});

test.describe("multi-section leader permissions", () => {
  const account = credentials("E2E_MULTI_SECTION_LEADER");
  const expectedSections = (process.env.E2E_MULTI_SECTION_LEADER_SECTIONS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  test("multi-section leader profile advertises all assigned sections", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!account || expectedSections.length < 2, "Configure the seeded E2E test password and expected sections.");
    await loginLeader(page, account!);

    for (const section of expectedSections) {
      await expect(page.getByText(section, { exact: false }).first()).toBeVisible();
    }
    await openLeaderMenu(page);
    await expect(page.getByRole("link", { name: "Member History" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reports & Exports" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leader Access" })).toHaveCount(0);
  });
});

test.describe("admin permissions", () => {
  const account = credentials("E2E_ADMIN");

  test("admin sees parent and leader access management", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!account, "Configure the seeded E2E test password to run this check.");
    await loginLeader(page, account!);

    await expect(page.getByText(/· admin/i).first()).toBeVisible();
    await openLeaderMenu(page);
    await expect(page.getByRole("link", { name: "Member History" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reports & Exports" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Parent Access" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leader Access" })).toBeVisible();

    await page.getByRole("link", { name: "Leader Access" }).click();
    await expect(page.getByRole("heading", { name: "Leader Access" })).toBeVisible();
  });
});

test.describe("super-admin permissions", () => {
  const account = credentials("E2E_SUPER_ADMIN");

  test("super admin can open the full access-management area", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!account, "Configure the seeded E2E test password to run this check.");
    await loginLeader(page, account!);

    await expect(page.getByText(/· super-admin/i).first()).toBeVisible();
    await openLeaderMenu(page);
    await expect(page.getByRole("link", { name: "Member History" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Reports & Exports" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Parent Access" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Leader Access" })).toBeVisible();

    await page.goto("/leader/access");
    await expect(page.getByRole("heading", { name: "Leader Access" })).toBeVisible();
    await expect(page.getByText(/Only a Super Admin can grant or remove Admin access/i)).toBeVisible();
  });
});