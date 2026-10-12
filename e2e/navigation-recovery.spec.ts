import { expect, test } from "@playwright/test";
import { credentials, login, openMenu, exposeGroup, clickNavItem, assertSiblingNotCurrent, projectNavigation, exposeQuartermaster } from "./support/navigation-recovery-helpers";

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
    await expect(page.getByTestId("equipment-reports-panel")).toBeVisible();
    await expect(page.getByLabel("Report")).toBeVisible();
    await expect(page.getByTestId("page-secretary-reports")).toHaveCount(0);

    await page.getByRole("link", { name: "Back to Equipment & Stores" }).click();
    await expect(page).toHaveURL("/leader/equipment?view=quartermaster");
    navigation = await exposeQuartermaster(page, testInfo);
    const reportedIssues = navigation.getByTestId("leader-nav-qm-equipment-issues");
    await expect(reportedIssues).toBeVisible();
    await reportedIssues.click();
    await expect(page).toHaveURL(/\/leader\/equipment\/issues\?view=quartermaster$/);
    await expect(page.getByTestId("page-qm-equipment-issues")).toBeVisible();
    await page.getByRole("link", { name: "Back to Equipment & Stores" }).click();
    await expect(page).toHaveURL(/\/leader\/equipment\?view=quartermaster$/);
  });

  test("SW-365 direct QM destinations select only the matching menu item", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    const destinations = [
      ["/leader/equipment?view=quartermaster", "qm-equipment-stores", "qm-equipment-stores"],
      ["/leader/equipment/issues?view=quartermaster", "qm-equipment-issues", "qm-equipment-issues"],
      ["/leader/qm-reports", "qm-reports", "qm-reports"],
      ["/leader/settings?view=quartermaster", "qm-settings", "qm-settings"]
    ] as const;

    for (const [route, pageIdentity, currentItemId] of destinations) {
      await page.goto(route);
      await expect(page.getByTestId(`page-${pageIdentity}`)).toBeVisible();
      await page.reload();
      await expect(page.getByTestId(`page-${pageIdentity}`)).toBeVisible();

      let navigation = await exposeQuartermaster(page, testInfo);
      await expect(navigation.getByTestId(`leader-nav-${currentItemId}`)).toHaveAttribute("aria-current", "page");
      await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);

      if (testInfo.project.name === "mobile-chromium") {
        const quartermaster = navigation.getByRole("button", { name: "Quartermaster / Bo’sun" });
        await quartermaster.click();
        await expect(quartermaster).toHaveAttribute("aria-expanded", "false");
        await quartermaster.click();
        await expect(quartermaster).toHaveAttribute("aria-expanded", "true");
      } else {
        const menuToggle = page.getByTestId("leader-dashboard-header").locator('button[aria-controls="leader-navigation"]');
        await menuToggle.click();
        await expect(menuToggle).toHaveAttribute("aria-expanded", "false");
        await menuToggle.click();
        await expect(menuToggle).toHaveAttribute("aria-expanded", "true");
      }

      navigation = projectNavigation(page, testInfo);
      await expect(navigation.getByTestId(`leader-nav-${currentItemId}`)).toHaveAttribute("aria-current", "page");
      await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
    }
  });

  test("Treasurer Reports remains distinct from QM Reports", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await openMenu(page, testInfo);
    const navigation = projectNavigation(page, testInfo);
    await expect(navigation).toBeVisible();
    if ((await navigation.getByRole("button", { name: "Treasurer" }).count()) > 0) {
      await navigation.getByRole("button", { name: "Treasurer" }).click();
    }
    const treasurerReports = navigation.getByTestId("leader-nav-treasurer-reports");
    await expect(treasurerReports).toBeVisible();
    await treasurerReports.click();
    await expect(page).toHaveURL(/\/leader\/reports\?view=treasurer$/);
    await expect(page.getByTestId("page-treasurer-reports")).toBeVisible();
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
    await expect(page.getByTestId("page-treasurer-settings")).toHaveCount(0);

    await openMenu(page, testInfo);
    navigation = projectNavigation(page, testInfo);
    await expect(navigation).toBeVisible();
    if ((await navigation.getByRole("button", { name: "Treasurer" }).count()) > 0) {
      await navigation.getByRole("button", { name: "Treasurer" }).click();
    }
    await navigation.getByTestId("leader-nav-treasurer-settings").click();
    await expect(page).toHaveURL(/\/leader\/settings\?view=treasurer$/);
    await expect(page.getByTestId("page-treasurer-settings")).toBeVisible();
    await expect(page.getByTestId("page-qm-settings")).toHaveCount(0);

    await openMenu(page, testInfo);
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

    navigation = await exposeGroup(page, testInfo, "Group Operations");
    await expect(navigation.getByTestId("leader-nav-group-equipment-stores")).toHaveAttribute("aria-current", "page");
    await assertSiblingNotCurrent(page, testInfo, "Quartermaster / Bo’sun", "qm-equipment-stores");
  });


  test("Group Operations Subs remains distinct from Family Billing", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await openMenu(page, testInfo);
    let navigation = projectNavigation(page, testInfo);
    await expect(navigation).toBeVisible();
    if ((await navigation.getByRole("button", { name: "Group Operations" }).count()) > 0) {
      await navigation.getByRole("button", { name: "Group Operations" }).click();
    }
    await navigation.getByTestId("leader-nav-group-subs").click();
    await expect(page).toHaveURL(/\/leader\/subs\?view=group-operations$/);
    await expect(page.getByTestId("page-group-subs")).toBeVisible();
    await expect(page).not.toHaveURL(/#family-billing$/);

    navigation = await exposeGroup(page, testInfo, "Group Operations");
    await expect(navigation.getByTestId("leader-nav-group-subs")).toHaveAttribute("aria-current", "page");
    navigation = await exposeGroup(page, testInfo, "People & Parents");
    await expect(navigation.getByTestId("leader-nav-family-billing")).not.toHaveAttribute("aria-current", "page");

    const familyBilling = navigation.getByTestId("leader-nav-family-billing");
    await expect(familyBilling).toBeVisible();
    await familyBilling.click();
    await expect(page).toHaveURL(/\/leader\/subs#family-billing$/);
    await expect(page.getByTestId("page-subs")).toBeVisible();
    navigation = await exposeGroup(page, testInfo, "People & Parents");
    await expect(navigation.getByTestId("leader-nav-family-billing")).toHaveAttribute("aria-current", "page");
    await assertSiblingNotCurrent(page, testInfo, "Group Operations", "group-subs");
  });


  test("Secretary and Group Operations Meeting Records retain distinct navigation identity", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await clickNavItem(page, testInfo, "Group Operations", "group-meeting-records");
    await expect(page).toHaveURL(/\/leader\/meetings\?view=group-operations$/);
    let navigation = projectNavigation(page, testInfo);
    await expect(page.getByTestId("page-group-meeting-records")).toBeVisible();

    navigation = await exposeGroup(page, testInfo, "Group Operations");
    await expect(navigation.getByTestId("leader-nav-group-meeting-records")).toHaveAttribute("aria-current", "page");
    await assertSiblingNotCurrent(page, testInfo, "Secretary", "secretary-meeting-records");

    await clickNavItem(page, testInfo, "Secretary", "secretary-meeting-records");
    await expect(page).toHaveURL(/\/leader\/meetings\?view=secretary$/);
    await expect(page.getByTestId("page-secretary-meeting-records")).toBeVisible();
  });


  test("Insights Reports & Exports remains distinct from Treasurer Reports", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await openMenu(page, testInfo);
    let navigation = projectNavigation(page, testInfo);
    if ((await navigation.getByRole("button", { name: "Insights & Records" }).count()) > 0) await navigation.getByRole("button", { name: "Insights & Records" }).click();
    await navigation.getByTestId("leader-nav-reports-exports").click();
    await expect(page).toHaveURL(/\/leader\/reports\?view=insights$/);
    await expect(page.getByTestId("page-reports-exports")).toBeVisible();
    await expect(page.getByTestId("page-treasurer-reports")).toHaveCount(0);

    navigation = await exposeGroup(page, testInfo, "Insights & Records");
    await expect(navigation.getByTestId("leader-nav-reports-exports")).toHaveAttribute("aria-current", "page");
    await assertSiblingNotCurrent(page, testInfo, "Treasurer", "treasurer-reports");
  });


  test("Administration Settings remains distinct from Treasurer and QM Settings", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await openMenu(page, testInfo);
    let navigation = projectNavigation(page, testInfo);
    if ((await navigation.getByRole("button", { name: "Administration" }).count()) > 0) await navigation.getByRole("button", { name: "Administration" }).click();
    await navigation.getByTestId("leader-nav-settings").click();
    await expect(page).toHaveURL(/\/leader\/settings$/);
    await expect(page.getByTestId("page-settings")).toBeVisible();
    await expect(page.getByTestId("page-treasurer-settings")).toHaveCount(0);
    await expect(page.getByTestId("page-qm-settings")).toHaveCount(0);

    navigation = await exposeGroup(page, testInfo, "Administration");
    await expect(navigation.getByTestId("leader-nav-settings")).toHaveAttribute("aria-current", "page");
    await assertSiblingNotCurrent(page, testInfo, "Treasurer", "treasurer-settings");
    await assertSiblingNotCurrent(page, testInfo, "Quartermaster / Bo’sun", "qm-settings");
  });


  test("Treasurer and Group Operations Floats retain distinct navigation identity", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await openMenu(page, testInfo);
    let navigation = projectNavigation(page, testInfo);
    if ((await navigation.getByRole("button", { name: "Group Operations" }).count()) > 0) await navigation.getByRole("button", { name: "Group Operations" }).click();
    await navigation.getByTestId("leader-nav-group-section-floats").click();
    await expect(page).toHaveURL(/\/leader\/finance\?view=group-operations$/);
    await expect(page.getByTestId("page-group-section-floats")).toBeVisible();
    navigation = await exposeGroup(page, testInfo, "Group Operations");
    await expect(navigation.getByTestId("leader-nav-group-section-floats")).toHaveAttribute("aria-current", "page");
    await assertSiblingNotCurrent(page, testInfo, "Treasurer", "treasurer-floats");

    navigation = await exposeGroup(page, testInfo, "Treasurer");
    await expect(navigation.getByTestId("leader-nav-treasurer-floats")).toBeVisible();
    await navigation.getByTestId("leader-nav-treasurer-floats").click();
    await expect(page).toHaveURL(/\/leader\/finance\?view=treasurer$/);
    await expect(page.getByTestId("page-treasurer-floats")).toBeVisible();
  });

  test("ordinary leader is not shown officer-specific navigation", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_LEADER"));
    await openMenu(page, testInfo);
    await expect(page.getByTestId("leader-nav-qm-equipment-stores")).toHaveCount(0);
    await expect(page.getByTestId("leader-nav-qm-reports")).toHaveCount(0);
    await expect(page.getByTestId("leader-nav-secretary-reports")).toHaveCount(0);

    await page.goto("/leader/qm-reports");
    await expect(page.getByText("Quartermaster / Bo’sun equipment-management access is required.")).toBeVisible();
    await expect(page.getByTestId("qm-report-content")).toHaveCount(0);
  });


  test("ordinary leader canonical Programme navigation works and officer menus stay absent", async ({ page }, testInfo) => {
    await login(page, credentials("E2E_LEADER"));
    for (const [itemId, route, destinationHeading] of [
      ["weekly-meetings", "/leader/weekly", /Weekly Meetings/i],
      ["events-activities", "/leader/events", /Events & Activities/i],
      ["badgework", "/leader/badgework", /Badgework|Adventure Skills/i],
    ] as const) {
      const navigation = await exposeGroup(page, testInfo, "Programme");
      await navigation.getByTestId("leader-nav-" + itemId).click();
      await expect(page).toHaveURL(new RegExp(route.replaceAll("/", "\\/") + "$"));
      await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
      await expect(page.getByRole("heading", { name: destinationHeading }).first()).toBeVisible();
      await expect(page.getByTestId("leader-navigation-desktop").getByTestId("leader-nav-secretary-reports")).toHaveCount(0);
      await expect(page.getByTestId("leader-navigation-desktop").getByTestId("leader-nav-qm-reports")).toHaveCount(0);
    }
  });

    test("SW-132 redundant refresh controls stay absent on administration pages", async ({ page }) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    for (const route of ["/leader/join", "/leader/event-consent", "/leader/parent-access", "/leader/activity"]) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Refresh", exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Reload", exact: true })).toHaveCount(0);
    }
  });

  test("SW-174 Weekly Meetings has no visible title tile and keeps Create Meeting usable without overflow", async ({ page }) => {
    await login(page, credentials("E2E_SUPER_ADMIN"));
    await page.goto("/leader/weekly");
    // Keep the semantic h1 for accessibility; SW-174 removes the redundant visual title card/introduction.
    await expect(page.getByRole("heading", { name: "Weekly Meetings" })).toBeAttached();
    await expect(page.getByTestId("leader-page-actions")).toHaveCount(0);
    await expect(page.getByText("Manage weekly meetings", { exact: false })).toHaveCount(0);
    const create = page.getByRole("link", { name: "Create Meeting" });
    await expect(create).toBeVisible();
    await create.click();
    await expect(page).toHaveURL(/\/leader\/weekly\/create$/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
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
