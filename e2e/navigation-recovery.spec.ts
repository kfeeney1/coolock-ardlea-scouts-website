import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Credentials = { email: string; password: string };

function credentials(prefix: string): Credentials {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`] || process.env.E2E_TEST_USER_PASSWORD;
  if (!email || !password) throw new Error(`Missing required ${prefix} navigation-test credentials`);
  return { email, password };
}

async function login(page: Page, account: Credentials) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function openMenu(page: Page) {
  await page.getByRole("button", { name: /(Open Leader Menu|Menu ·)/ }).click();
}

function projectNavigation(page: Page, testInfo: TestInfo) {
  return page.getByTestId(testInfo.project.name === "mobile-chromium"
    ? "leader-navigation-mobile"
    : "leader-navigation-desktop");
}

async function exposeQuartermaster(page: Page, testInfo: TestInfo) {
  await openMenu(page);
  const navigation = projectNavigation(page, testInfo);
  await expect(navigation).toBeVisible();
  if ((await navigation.getByRole("button", { name: "Quartermaster / Bo’sun" }).count()) > 0) {
    await navigation.getByRole("button", { name: "Quartermaster / Bo’sun" }).click();
  }
  return navigation;
}

test.describe("SW-178 canonical role navigation", () => {
  test("super admin reaches Equipment and Stores and QM Reports canonical destinations", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));

    let navigation = await exposeQuartermaster(page, testInfo);
    const equipment = navigation.getByTestId("leader-nav-qm-equipment-stores");
    await expect(equipment).toBeVisible();
    await equipment.click();
    await expect(page).toHaveURL(/\/leader\/equipment$/);
    await expect(page.getByTestId("page-equipment-stores")).toBeVisible();
    await expect(page.getByTestId("page-secretary-reports")).toHaveCount(0);

    navigation = await exposeQuartermaster(page, testInfo);
    const qmReports = navigation.getByTestId("leader-nav-qm-reports");
    await expect(qmReports).toBeVisible();
    await qmReports.focus();
    await expect(qmReports).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/leader\/qm-reports$/);
    await expect(page.getByTestId("page-qm-reports")).toBeVisible();
    await expect(page.getByTestId("qm-report-content")).toBeVisible();
    await expect(page.getByTestId("page-secretary-reports")).toHaveCount(0);
  });

  test("Secretary Reports remains distinct from QM Reports", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await openMenu(page);
    const navigation = projectNavigation(page, testInfo);
    await expect(navigation).toBeVisible();
    if ((await navigation.getByRole("button", { name: "Secretary" }).count()) > 0) {
      await navigation.getByRole("button", { name: "Secretary" }).click();
    }
    const secretaryReports = navigation.getByTestId("leader-nav-secretary-reports");
    await expect(secretaryReports).toBeVisible();
    await secretaryReports.click();
    await expect(page).toHaveURL(/\/leader\/reports$/);
    await expect(page.getByTestId("page-secretary-reports")).toBeVisible();
    await expect(page.getByTestId("page-qm-reports")).toHaveCount(0);
  });

  test("ordinary leader is not shown officer-specific navigation", async ({ page }) => {
    await login(page, credentials("E2E_LEADER"));
    await openMenu(page);
    await expect(page.getByTestId("leader-nav-qm-equipment-stores")).toHaveCount(0);
    await expect(page.getByTestId("leader-nav-qm-reports")).toHaveCount(0);
    await expect(page.getByTestId("leader-nav-secretary-reports")).toHaveCount(0);

    await page.goto("/leader/qm-reports");
    await expect(page.getByText("Quartermaster / Bo’sun equipment-management access is required.")).toBeVisible();
    await expect(page.getByTestId("qm-report-content")).toHaveCount(0);
  });

  test("redundant Join Us and Event Consent Refresh controls are absent", async ({ page }) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await page.goto("/leader/join");
    await expect(page.getByTestId("page-join-management")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toHaveCount(0);
    await page.goto("/leader/event-consent");
    await expect(page.getByTestId("page-event-consent")).toBeVisible();
    await expect(page.getByRole("button", { name: "Refresh", exact: true })).toHaveCount(0);
  });
});
