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
    await expect(page).toHaveURL(/\/leader\/equipment\?view=quartermaster$/);
    await expect(page.getByTestId("page-qm-equipment-stores")).toBeVisible();
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
    await expect(page).toHaveURL(/\/leader\/reports\?view=secretary$/);
    await expect(page.getByTestId("page-secretary-reports")).toBeVisible();
    await expect(page.getByTestId("page-qm-reports")).toHaveCount(0);
  });


  test("role-specific settings and equipment destinations retain their own identity", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));

    let navigation = await exposeQuartermaster(page, testInfo);
    const qmSettings = navigation.getByTestId("leader-nav-qm-settings");
    await expect(qmSettings).toBeVisible();
    await qmSettings.click();
    await expect(page).toHaveURL(/\/leader\/settings\?view=quartermaster$/);
    await expect(page.getByTestId("page-qm-settings")).toBeVisible();
    await expect(page.getByTestId("page-secretary-settings")).toHaveCount(0);

    await openMenu(page);
    navigation = projectNavigation(page, testInfo);
    await expect(navigation).toBeVisible();
    if ((await navigation.getByRole("button", { name: "Secretary" }).count()) > 0) {
      await navigation.getByRole("button", { name: "Secretary" }).click();
    }
    await navigation.getByTestId("leader-nav-secretary-settings").click();
    await expect(page).toHaveURL(/\/leader\/settings\?view=secretary$/);
    await expect(page.getByTestId("page-secretary-settings")).toBeVisible();
    await expect(page.getByTestId("page-qm-settings")).toHaveCount(0);

    await openMenu(page);
    navigation = projectNavigation(page, testInfo);
    await expect(navigation).toBeVisible();
    if ((await navigation.getByRole("button", { name: "Group Operations" }).count()) > 0) {
      await navigation.getByRole("button", { name: "Group Operations" }).click();
    }
    const groupEquipment = navigation.getByTestId("leader-nav-group-equipment-stores");
    await groupEquipment.click();
    await expect(page).toHaveURL(/\/leader\/equipment\?view=group-operations$/);
    await expect(page.getByTestId("page-group-equipment-stores")).toBeVisible();
    await expect(page.getByTestId("page-qm-equipment-stores")).toHaveCount(0);

    await openMenu(page);
    navigation = projectNavigation(page, testInfo);
    await expect(navigation.getByTestId("leader-nav-group-equipment-stores")).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByTestId("leader-nav-qm-equipment-stores")).not.toHaveAttribute("aria-current", "page");
  });


  test("Group Operations Subs remains distinct from Family Billing", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await openMenu(page);
    let navigation = projectNavigation(page, testInfo);
    await expect(navigation).toBeVisible();
    if ((await navigation.getByRole("button", { name: "Group Operations" }).count()) > 0) {
      await navigation.getByRole("button", { name: "Group Operations" }).click();
    }
    await navigation.getByTestId("leader-nav-group-subs").click();
    await expect(page).toHaveURL(/\/leader\/subs\?view=group-operations$/);
    await expect(page.getByTestId("page-group-subs")).toBeVisible();
    await expect(page).not.toHaveURL(/#family-billing$/);

    await openMenu(page);
    navigation = projectNavigation(page, testInfo);
    await expect(navigation.getByTestId("leader-nav-group-subs")).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByTestId("leader-nav-family-billing")).not.toHaveAttribute("aria-current", "page");

    await navigation.getByTestId("leader-nav-family-billing").click();
    await expect(page).toHaveURL(/\/leader\/subs#family-billing$/);
    await openMenu(page);
    navigation = projectNavigation(page, testInfo);
    await expect(navigation.getByTestId("leader-nav-family-billing")).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByTestId("leader-nav-group-subs")).not.toHaveAttribute("aria-current", "page");
  });


  test("Secretary and Group Operations Meeting Records retain distinct navigation identity", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await openMenu(page);
    let navigation = projectNavigation(page, testInfo);
    if ((await navigation.getByRole("button", { name: "Group Operations" }).count()) > 0) await navigation.getByRole("button", { name: "Group Operations" }).click();
    await navigation.getByTestId("leader-nav-group-meeting-records").click();
    await expect(page).toHaveURL(/\/leader\/meetings\?view=group-operations$/);
    await expect(page.getByTestId("page-group-meeting-records")).toBeVisible();

    await openMenu(page);
    navigation = projectNavigation(page, testInfo);
    await expect(navigation.getByTestId("leader-nav-group-meeting-records")).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByTestId("leader-nav-secretary-meeting-records")).not.toHaveAttribute("aria-current", "page");

    if ((await navigation.getByRole("button", { name: "Secretary" }).count()) > 0) await navigation.getByRole("button", { name: "Secretary" }).click();
    await navigation.getByTestId("leader-nav-secretary-meeting-records").click();
    await expect(page).toHaveURL(/\/leader\/meetings\?view=secretary$/);
    await expect(page.getByTestId("page-secretary-meeting-records")).toBeVisible();
  });


  test("Insights Reports & Exports remains distinct from Secretary Reports", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await openMenu(page);
    let navigation = projectNavigation(page, testInfo);
    if ((await navigation.getByRole("button", { name: "Insights & Records" }).count()) > 0) await navigation.getByRole("button", { name: "Insights & Records" }).click();
    await navigation.getByTestId("leader-nav-reports-exports").click();
    await expect(page).toHaveURL(/\/leader\/reports\?view=insights$/);
    await expect(page.getByTestId("page-reports-exports")).toBeVisible();
    await expect(page.getByTestId("page-secretary-reports")).toHaveCount(0);

    await openMenu(page);
    navigation = projectNavigation(page, testInfo);
    await expect(navigation.getByTestId("leader-nav-reports-exports")).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByTestId("leader-nav-secretary-reports")).not.toHaveAttribute("aria-current", "page");
  });


  test("Administration Settings remains distinct from Secretary and QM Settings", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await openMenu(page);
    let navigation = projectNavigation(page, testInfo);
    if ((await navigation.getByRole("button", { name: "Administration" }).count()) > 0) await navigation.getByRole("button", { name: "Administration" }).click();
    await navigation.getByTestId("leader-nav-settings").click();
    await expect(page).toHaveURL(/\/leader\/settings$/);
    await expect(page.getByTestId("page-settings")).toBeVisible();
    await expect(page.getByTestId("page-secretary-settings")).toHaveCount(0);
    await expect(page.getByTestId("page-qm-settings")).toHaveCount(0);

    await openMenu(page);
    navigation = projectNavigation(page, testInfo);
    await expect(navigation.getByTestId("leader-nav-settings")).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByTestId("leader-nav-secretary-settings")).not.toHaveAttribute("aria-current", "page");
    await expect(navigation.getByTestId("leader-nav-qm-settings")).not.toHaveAttribute("aria-current", "page");
  });


  test("Secretary and Group Operations Floats retain distinct navigation identity", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await openMenu(page);
    let navigation = projectNavigation(page, testInfo);
    if ((await navigation.getByRole("button", { name: "Group Operations" }).count()) > 0) await navigation.getByRole("button", { name: "Group Operations" }).click();
    await navigation.getByTestId("leader-nav-group-section-floats").click();
    await expect(page).toHaveURL(/\/leader\/finance\?view=group-operations$/);
    await expect(page.getByTestId("page-group-section-floats")).toBeVisible();
    await openMenu(page);
    navigation = projectNavigation(page, testInfo);
    await expect(navigation.getByTestId("leader-nav-group-section-floats")).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByTestId("leader-nav-secretary-floats")).not.toHaveAttribute("aria-current", "page");

    if ((await navigation.getByRole("button", { name: "Secretary" }).count()) > 0) await navigation.getByRole("button", { name: "Secretary" }).click();
    await navigation.getByTestId("leader-nav-secretary-floats").click();
    await expect(page).toHaveURL(/\/leader\/finance\?view=secretary$/);
    await expect(page.getByTestId("page-secretary-floats")).toBeVisible();
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
