import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_PARENT_LEADER_EMAIL || "test.beaver.section.leader@example.com";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Operations overview checks run once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
}

for (const [role, email] of [
  ["Admin", "test.webadmin@example.com"],
  ["Super Admin", "superadmin@example.com"]
] as const) {
  test(`${role} sees the full operations overview and approval queues`, async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

    await login(page, email);
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Operations Overview" })).toHaveCount(0);

    const overview = page.getByTestId("admin-overview");
    await expect(overview.getByText("Unable to load the operations overview right now.")).toHaveCount(0);
    await expect(overview.getByText("Scope: All sections")).toBeVisible();
    await expect(overview.getByText("Pending Parent Requests")).toBeVisible();
    await expect(overview.getByText("Pending Leader Requests")).toBeVisible();
    await expect(overview.getByText("New Join Applications")).toBeVisible();
    await expect(overview.getByText("Active Members", { exact: true })).toBeVisible();
    await expect(overview.getByText("Outstanding Event Consent")).toBeVisible();
    await expect(overview.getByRole("heading", { name: "Members by Section" })).toBeVisible();
    await expect(overview.getByRole("heading", { name: "Upcoming Events" })).toBeVisible();

    const operationalHealth = page.getByRole("heading", { name: "Operational health" });
    if (role === "Super Admin") {
      await expect(operationalHealth).toBeVisible();
      await expect(page.getByText("Deployed release")).toBeVisible();
      await expect(page.getByText("Firestore", { exact: true })).toBeVisible();
      await expect(page.getByText("Email service")).toBeVisible();
      await expect(page.getByText("Attachment storage")).toBeVisible();
      await expect(page.getByText("Operational data integrity")).toBeVisible();
      const runDataCheck = page.getByRole("button", { name: "Run data check" });
      await expect(runDataCheck).toBeVisible();
      await runDataCheck.click();
      const dataHealth = page.getByTestId("operational-health-data-integrity");
      await expect(dataHealth.getByText("Check", { exact: true })).toBeVisible();
      await expect(dataHealth).toContainText("7 relationship findings");
      await expect(dataHealth).toContainText("consentApplications");
      await expect(dataHealth).toContainText("equipmentItems");
      await expect(dataHealth.getByRole("link", { name: "Consent records" })).toHaveAttribute("href", "/leader/consents");
      await expect(dataHealth.getByRole("link", { name: "Equipment" })).toHaveAttribute("href", "/leader/equipment");
    } else {
      await expect(operationalHealth).toHaveCount(0);
    }

    await expect(overview.getByRole("link", { name: /^Pending Parent Requests:/ })).toHaveAttribute("href", "/leader/parent-access");
    await expect(overview.getByRole("link", { name: /^Pending Leader Requests:/ })).toHaveAttribute("href", "/leader/requests");
    await expect(overview.getByRole("link", { name: /^New Join Applications:/ })).toHaveAttribute("href", "/leader/join");
    await expect(overview.getByRole("link", { name: /^Active Members:/ })).toHaveAttribute("href", "/leader/members");
    await expect(overview.getByRole("link", { name: /^Outstanding Event Consent:/ })).toHaveAttribute("href", "/leader/event-consent");
    await expect(overview.getByRole("link", { name: /^Upcoming Events:/ })).toHaveAttribute("href", "/leader/events");
    await expect(overview.getByRole("link", { name: "Manage Members" })).toHaveAttribute("href", "/leader/members");
    await expect(overview.getByRole("link", { name: "View All" })).toHaveAttribute("href", "/leader/events");
  });
}

test("section leader sees a scoped operations overview with linked tiles", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page, leaderEmail!);
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Operations Overview" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Operational health" })).toHaveCount(0);

  const overview = page.getByTestId("admin-overview");
  await expect(overview.getByText("Unable to load the operations overview right now.")).toHaveCount(0);
  await expect(overview.getByText(/^Scope:/)).toBeVisible();
  await expect(overview.getByText("New Join Applications")).toBeVisible();
  await expect(overview.getByText("Active Members", { exact: true })).toBeVisible();
  await expect(overview.getByText("Outstanding Event Consent")).toBeVisible();
  await expect(overview.getByText("Pending Parent Requests")).toHaveCount(0);
  await expect(overview.getByText("Pending Leader Requests")).toHaveCount(0);

  await expect(overview.getByRole("link", { name: /^New Join Applications:/ })).toHaveAttribute("href", "/leader/join");
  await expect(overview.getByRole("link", { name: /^Active Members:/ })).toHaveAttribute("href", "/leader/members");
  await expect(overview.getByRole("link", { name: /^Outstanding Event Consent:/ })).toHaveAttribute("href", "/leader/event-consent");
  await expect(overview.getByRole("link", { name: /^Upcoming Events:/ })).toHaveAttribute("href", "/leader/events");

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  await overview.getByRole("link", { name: /^Active Members:/ }).click();
  await expect(page).toHaveURL(/\/leader\/members$/);
  await expect(page.getByRole("heading", { name: /Member Management/i })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("SW-319 dashboard medical reminder opens the leader's own form with a readable mobile action", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Scouter form reminder runs on desktop and Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await login(page, "test.webadmin@example.com");
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

  const reminder = page.getByTestId("leader-medical-action");
  const openForm = reminder.getByRole("link", { name: "Open My Form" });
  await expect(openForm).toBeVisible();
  await expect(openForm).toHaveAttribute("href", "/leader/profile/consent");
  await expect(openForm).toHaveCSS("white-space", "nowrap");
  if (testInfo.project.name === "mobile-chromium") {
    const dimensions = await openForm.evaluate((element) => ({
      viewport: document.documentElement.clientWidth,
      right: element.getBoundingClientRect().right,
      labelWidth: element.scrollWidth,
      contentWidth: element.clientWidth
    }));
    expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.labelWidth).toBeLessThanOrEqual(dimensions.contentWidth);
  }

  await openForm.click();
  await expect(page).toHaveURL(/\/leader\/profile\/consent$/);
  await expect(page.getByRole("heading", { name: "Scouter Medical Advice Form" })).toBeVisible();
});


const groupYouthChampionEmail = process.env.E2E_GROUP_YOUTH_CHAMPION_EMAIL;

for (const project of ["chromium", "mobile-chromium"]) {
  test(`SW-358 Group Youth Champion loads only permitted overview data on ${project}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== project, "Run once per desktop and mobile Chromium project.");
    test.skip(!password || !groupYouthChampionEmail, "Configure the synthetic multi-section Group Youth Champion account.");

    await login(page, groupYouthChampionEmail!);
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
    const overview = page.getByTestId("admin-overview");
    await expect(overview.getByText("Unable to load the operations overview right now.")).toHaveCount(0);
    await expect(overview.getByText("Scope: Beavers, Scouts")).toBeVisible();
    await expect(overview.getByText("Active Members", { exact: true })).toBeVisible();

    await page.reload();
    await expect(overview.getByText("Unable to load the operations overview right now.")).toHaveCount(0);
    await page.goto("/leader");
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
    await expect(page.getByTestId("admin-overview").getByText("Unable to load the operations overview right now.")).toHaveCount(0);
  });
}

test("Group Leader loads the operations overview within authorised account sections", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await login(page, "test.group.leader@example.com");
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

  const overview = page.getByTestId("admin-overview");
  await expect(overview.getByText("Unable to load the operations overview right now.")).toHaveCount(0);
  await expect(overview.getByText(/^Scope: (?!All sections$).+/)).toBeVisible();
  await expect(overview.getByText("Pending Parent Requests")).toHaveCount(0);
  await expect(overview.getByText("Pending Leader Requests")).toHaveCount(0);
  await expect(overview.getByText("Active Members", { exact: true })).toBeVisible();
});

test("Dashboard consent detail uses the canonical medication presentation", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await login(page, "test.webadmin@example.com");
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

  await page.getByLabel("Search submissions").fill("Synthetic test medicine");
  const medicationRecord = page.getByRole("button", { name: "View" });
  await expect(medicationRecord).toHaveCount(1);
  await medicationRecord.click();

  const panel = page.getByTestId("medication-management-panel");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Medicine");
  await expect(panel).toContainText("Pharmacy Telephone");
  await expect(panel).toContainText("Signature Date");
  for (const rawKey of ["pharmacyTel", "otherInfo", "medicineName", "memberName", "signatureDate", "authTo", "authFrom"]) {
    await expect(page.getByText(rawKey, { exact: true })).toHaveCount(0);
  }
});
