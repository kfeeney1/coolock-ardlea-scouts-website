import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Record-page navigation runs once on desktop Chromium.");
}

async function loginAdmin(page: Page, email = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com") {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("Join Us enquiry tiles open full-page records", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/join");

  const card = page.locator('[data-testid^="join-record-"]').first();
  await expect(card).toBeVisible();
  const href = await card.getAttribute("href");
  expect(href).toMatch(/^\/leader\/join\/.+/);
  await expect(card.getByRole("button", { name: "Open enquiry", exact: true })).toBeVisible();
  await card.click();

  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await expect(page.locator('[data-testid^="join-record-page-"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Notes", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add Contact", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("SW-296 Join Us edits remain local until explicit Save and persist after Save", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/join/TEST_flow_join_contacted");

  const notes = page.getByPlaceholder("Internal notes about this joining enquiry...");
  await expect(notes).toHaveValue("");
  const save = page.getByRole("button", { name: "Saved", exact: true });
  await expect(save).toBeDisabled();

  await notes.fill("SW-296 unsaved draft");
  await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toBeEnabled();
  await page.reload();
  await expect(notes).toHaveValue("");

  await notes.fill("SW-296 persisted draft");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByText("Join Us enquiry saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(notes).toHaveValue("SW-296 persisted draft");

  await notes.fill("");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByText("Join Us enquiry saved.", { exact: true })).toBeVisible();
});

test("Join application action deep link preserves login target and hides out-of-scope records", async ({ browser }) => {
  const applicationPath = "/leader/join/TEST_flow_join_accepted";
  const emailTarget = `${applicationPath}?source=email#application`;
  const adminContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  await adminPage.goto(emailTarget);
  await expect(adminPage).toHaveURL(/\/leader\/login$/);
  await adminPage.getByLabel("Email address").fill(process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com");
  await adminPage.getByLabel("Password").fill(password!);
  await adminPage.getByRole("button", { name: "Sign In" }).click();
  await expect(adminPage).toHaveURL(new RegExp(`${applicationPath}\\?source=email#application$`));
  await expect(adminPage.getByTestId("join-record-page-TEST_flow_join_accepted")).toBeVisible();
  await adminContext.close();

  const sectionContext = await browser.newContext();
  const sectionPage = await sectionContext.newPage();
  await sectionPage.goto(applicationPath);
  await expect(sectionPage).toHaveURL(/\/leader\/login$/);
  await sectionPage.getByLabel("Email address").fill(process.env.E2E_MULTI_SECTION_LEADER_EMAIL || "test.multi.section.leader@example.com");
  await sectionPage.getByLabel("Password").fill(password!);
  await sectionPage.getByRole("button", { name: "Sign In" }).click();
  await expect(sectionPage).toHaveURL(new RegExp(applicationPath + "$"));
  await expect(sectionPage.getByRole("alert")).toContainText("outside your permitted sections");
  await expect(sectionPage.getByText("Test accepted", { exact: true })).toHaveCount(0);
  await sectionContext.close();
});

test("access request email links preserve authentication and open the exact leader and parent records", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const leaderTarget = "/leader/requests?request=TEST_flow_leader_request_pending";
  await page.goto(leaderTarget);
  await expect(page).toHaveURL(/\/leader\/login$/);
  await page.getByLabel("Email address").fill(process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(new RegExp(`${leaderTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  const leaderRequest = page.getByRole("dialog", { name: "Review leader request" });
  await expect(leaderRequest).toBeVisible();
  await expect(leaderRequest).toContainText("Pending Scouter");
  await context.close();

  const parentContext = await browser.newContext();
  const parentPage = await parentContext.newPage();
  const parentTarget = "/leader/parent-access?parent=TEST_flow_parent_pending";
  await parentPage.goto(parentTarget);
  await expect(parentPage).toHaveURL(/\/leader\/login$/);
  await parentPage.getByLabel("Email address").fill(process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com");
  await parentPage.getByLabel("Password").fill(password!);
  await parentPage.getByRole("button", { name: "Sign In" }).click();
  await expect(parentPage).toHaveURL(new RegExp(`${parentTarget.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await expect(parentPage.getByTestId("parent-access-TEST_flow_parent_pending")).toBeInViewport();
  await expect(parentPage.getByTestId("parent-child-linking-TEST_flow_parent_pending")).toBeVisible();
  await parentContext.close();
});

test("Join Us member conversion requires review and cancel does not persist it", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/join/TEST_flow_join_accepted");

  const record = page.getByTestId("join-record-page-TEST_flow_join_accepted");
  await expect(record).toBeVisible();
  await expect(page.getByRole("heading", { name: "Test accepted", level: 1 })).toBeVisible();
  await expect(record).toContainText("Accepted");
  await expect(record).not.toContainText("Member Created");

  await page.getByRole("button", { name: "Create Member Record", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Create member record?" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText("Test accepted");
  await expect(confirmation).toContainText("start as Active in Ventures");
  await expect(confirmation).toContainText("linked to that member record");
  await expect(confirmation).toContainText("still Accepted and has not already been converted");

  await confirmation.getByRole("button", { name: "Cancel conversion", exact: true }).click();
  await expect(confirmation).toBeHidden();
  await expect(page.getByRole("button", { name: "Create Member Record", exact: true })).toBeVisible();
  await expect(record).not.toContainText("Member Created");

  await page.reload();
  await expect(page.getByTestId("join-record-page-TEST_flow_join_accepted")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Member Record", exact: true })).toBeVisible();
  await expect(page.getByText("Member Created", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Open Member Record", exact: true })).toHaveCount(0);
});

test("Consent tiles open full-page records", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/consents");

  const card = page.locator('[data-testid^="consent-record-"]').first();
  await expect(card).toBeVisible();
  const href = await card.getAttribute("href");
  expect(href).toMatch(/^\/leader\/consents\/.+/);
  await expect(card.getByRole("button", { name: "Open consent", exact: true })).toBeVisible();
  await card.click();

  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await expect(page.locator('[data-testid^="consent-record-page-"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Print / Save PDF", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});


test("SW-218 unlinked Venture consent creates a canonical member visible in Member Management", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Consent member creation mutates the shared fixture and runs once on desktop Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page, process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com");
  await page.goto("/leader/consents/TEST_flow_consent_venture_unlinked");

  const record = page.getByTestId("consent-record-page-TEST_flow_consent_venture_unlinked");
  await expect(record).toBeVisible();
  await expect(record.getByText("Not linked to member", { exact: true })).toBeVisible();
  await record.getByRole("button", { name: "Create new member from consent", exact: true }).click();
  await expect(record.getByText("Not linked to member", { exact: true })).toHaveCount(0);
  await expect(record.getByRole("button", { name: "Create new member from consent", exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("consent-record-page-TEST_flow_consent_venture_unlinked").getByText("Not linked to member", { exact: true })).toHaveCount(0);

  await page.goto("/leader/members");
  await page.getByLabel("Search members").fill("TEST Consent Venture");
  const memberCard = page.getByTestId(/member-card-/).filter({ hasText: "TEST Consent Venture" });
  await expect(memberCard).toBeVisible();
  await expect(memberCard).toContainText("Ventures");
  await expect(memberCard).toContainText("Active");

  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Ventures", exact: true }).click();
  await expect(memberCard).toBeVisible();
  await page.reload();
  await expect(page.getByTestId(/member-card-/).filter({ hasText: "TEST Consent Venture" })).toBeVisible();

  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "All Sections" }).click();
  await expect(page.getByTestId(/member-card-/).filter({ hasText: "TEST Consent Venture" })).toBeVisible();

  await memberCard.click();
  await expect(page).toHaveURL(/\/leader\/members\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "TEST Consent Venture", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Consent & Medical Indicators" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Open consent and medical details/ }).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
});
