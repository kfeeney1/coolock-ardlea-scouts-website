import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { loginAsLeader } from "./support/authentication-helpers";
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
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Stage Contact", exact: true })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("SW-629 dashboard opens the scoped waiting list in one action", async ({ page }) => {
  await loginAdmin(page, "test.scout.section.leader@example.com");
  await page.getByRole("link", { name: "Waiting list", exact: true }).click();

  await expect(page).toHaveURL(/\/leader\/join\?status=waiting-list$/);
  await expect(page.getByRole("combobox", { name: "Status", exact: true })).toHaveText("Waiting List");
  await expect(page.getByTestId("join-record-TEST_flow_join_waiting")).toBeVisible();

  await page.reload();
  await expect(page.getByRole("combobox", { name: "Status", exact: true })).toHaveText("Waiting List");
  await expect(page.getByTestId("join-record-TEST_flow_join_waiting")).toBeVisible();
  await page.getByRole("combobox", { name: "Status", exact: true }).click();
  await page.getByRole("option", { name: "All Statuses", exact: true }).click();
  await expect(page.getByTestId("join-record-TEST_flow_join_new")).toHaveCount(0);
});

test("SW-629 dashboard shortcut and direct URL require Join Us access", async ({ page }) => {
  await loginAdmin(page, "test.scout.programme.scouter@example.com");
  await expect(page.getByRole("link", { name: "Waiting list", exact: true })).toHaveCount(0);

  await page.goto("/leader/join?status=waiting-list");
  await expect(page).toHaveURL(/\/leader$/);
  await expect(page.getByTestId("page-join-management")).toHaveCount(0);
});

test("SW-629 a programme scouter adds an entry for their section without waiting-list view access", async ({ page, browser }) => {
  const lastName = "Prospect-" + randomUUID().slice(0, 8);
  await loginAdmin(page, "test.scout.programme.scouter@example.com");
  await page.getByRole("link", { name: "Add to waiting list", exact: true }).click();

  await expect(page.getByRole("combobox", { name: "Section", exact: true })).toHaveText("Scouts");
  await page.getByRole("combobox", { name: "Section", exact: true }).click();
  await expect(page.getByRole("option")).toHaveCount(1);
  await page.getByRole("option", { name: "Scouts", exact: true }).click();
  await page.getByLabel("First name").fill("TEST");
  await page.getByLabel("Last name").fill(lastName);
  await page.getByLabel("Date of birth", { exact: true }).fill("10-05-2016");
  await page.getByLabel("Parent / guardian name").fill("Test Parent");
  await page.getByLabel("Relationship", { exact: true }).fill("Parent");
  await page.getByLabel("Mobile number").fill("0870000000");
  await page.getByLabel("Email address").fill("sw629-waiting-list@example.com");
  await page.getByRole("button", { name: "Save waiting-list entry" }).click();
  await expect(page.getByText("Added to the waiting list.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "View waiting list", exact: true })).toHaveCount(0);

  const leaderContext = await browser.newContext();
  try {
    const leaderPage = await leaderContext.newPage();
    await loginAdmin(leaderPage, "test.scout.section.leader@example.com");
    await leaderPage.getByRole("link", { name: "Waiting list", exact: true }).click();
    const record = leaderPage.getByRole("link", { name: "Open TEST " + lastName, exact: true });
    await expect(record).toContainText("Waiting List");
    await leaderPage.reload();
    await expect(record).toContainText("Waiting List");
    await expect(record).not.toContainText("Member Created");
    await record.click();
    await expect(leaderPage.getByRole("heading", { name: "TEST " + lastName, exact: true })).toBeVisible();
    await expect(leaderPage.getByRole("button", { name: "Stage Contact", exact: true })).toBeVisible();
  } finally {
    await leaderContext.close();
  }
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
  page.once("dialog", (dialog) => void dialog.accept());
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

test("SW-299 Contact History is staged and persists only with Save Changes", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/join/TEST_flow_join_contacted");

  await page.getByLabel("Contact note").fill("SW-299 staged contact");
  await page.getByRole("button", { name: "Stage Contact", exact: true }).click();
  await expect(page.getByText("Pending save", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Changes", exact: true })).toBeEnabled();

  page.once("dialog", (dialog) => void dialog.accept());
  await page.reload();
  await expect(page.getByText("SW-299 staged contact", { exact: true })).toHaveCount(0);

  await page.getByLabel("Contact note").fill("SW-299 persisted contact");
  await page.getByRole("button", { name: "Stage Contact", exact: true }).click();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.getByText("Join Us enquiry saved.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("SW-299 persisted contact", { exact: true })).toBeVisible();
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
  await sectionPage.getByLabel("Email address").fill(process.env.E2E_PARENT_LEADER_EMAIL || "test.beaver.section.leader@example.com");
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
  await expect(page.getByRole("button", { name: "Print / Save PDF", exact: true })).toHaveCount(0);
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

test("SW-605 transferred consent follows the current section and retains the original submission", async ({ browser, page }, testInfo) => {
  desktopOnly(testInfo);
  const projectId = process.env.FIREBASE_PROJECT_ID;
  test.skip(!password || projectId !== "demo-coolock-ardlea-scouts"
    || !process.env.FIRESTORE_EMULATOR_HOST?.startsWith("127.0.0.1:"), "Requires the isolated synthetic Firebase emulator.");
  const firestore = getFirestore(getApps()[0] || initializeApp({ projectId }));
  const id = `sw605-${randomUUID()}`;
  const member = firestore.collection("members").doc(id);
  const consent = firestore.collection("consentApplications").doc(id);
  const displayName = `TEST Consent Transfer ${id.slice(-8)}`;
  const submission = {
    formType: "youth-activity-consent", status: "active", section: "Beavers", childName: displayName, memberId: id,
    formVersion: "sw605-synthetic", source: "website", submittedAt: Timestamp.fromDate(new Date("2026-10-20T12:00:00Z")),
    consentFrom: "2026-10-20", consentTo: "2027-08-31"
  };
  await member.set({
    firstName: "TEST", lastName: "Consent Transfer", displayName, dateOfBirth: "2018-01-01",
    section: "Beavers", sections: ["Beavers"], sectionRoles: {}, status: "active", source: "manual"
  });
  try {
    await consent.set(submission);
    await loginAdmin(page, process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com");
    await page.goto("/leader/consents");
    const card = page.getByTestId(`consent-record-${id}`);
    await expect(card.getByText("Beavers", { exact: true })).toBeVisible();
    const originalSubmission = await card.getByText(/^Submitted /).innerText();

    await page.goto("/leader/members");
    await page.getByLabel("Search members").fill(displayName);
    await page.getByRole("button", { name: "Select members", exact: true }).click();
    await page.getByRole("checkbox", { name: `Select ${displayName}` }).check();
    await page.getByRole("combobox", { name: "Destination section" }).click();
    await page.getByRole("option", { name: "Cubs", exact: true }).click();
    await page.getByRole("button", { name: "Change section", exact: true }).click();
    await page.getByRole("button", { name: "Confirm transfer", exact: true }).click();
    await expect(page.getByTestId(`member-card-${id}`).getByText("Cubs", { exact: true })).toBeVisible();

    await page.goto("/leader/consents");
    await expect(card).toHaveCount(1);
    await expect(card.getByText("Cubs", { exact: true })).toBeVisible();
    await expect(card.getByText(originalSubmission, { exact: true })).toBeVisible();
    const section = page.getByRole("combobox", { name: "Section", exact: true });
    await section.click();
    await page.getByRole("option", { name: "Beavers", exact: true }).click();
    await expect(card).toHaveCount(0);
    await section.click();
    await page.getByRole("option", { name: "Cubs", exact: true }).click();
    await expect(card).toHaveCount(1);
    expect((await consent.get()).data()).toEqual(submission);

    const oldContext = await browser.newContext();
    const newContext = await browser.newContext();
    try {
      const oldPage = await oldContext.newPage();
      const newPage = await newContext.newPage();
      await Promise.all([
        loginAsLeader(oldPage, { email: "test.beaver.section.leader@example.com", password: password! }),
        loginAsLeader(newPage, { email: "test.cub.section.leader@example.com", password: password! })
      ]);
      await Promise.all([oldPage.goto("/leader/consents"), newPage.goto("/leader/consents")]);
      await oldPage.getByLabel("Search consent records").fill(displayName);
      await expect(oldPage.getByText("No consent records match the current filters.")).toBeVisible();
      await newPage.getByTestId(`consent-record-${id}`).click();
      await expect(newPage.getByTestId(`consent-record-page-${id}`).getByText("Cubs", { exact: true }).first()).toBeVisible();
      await expect(newPage.getByRole("button", { name: "Print / Save PDF", exact: true })).toBeEnabled();
      await oldPage.goto(`/leader/consents/${id}`);
      await expect(oldPage.getByText("This consent record could not be found or is outside your permitted sections.")).toBeVisible();
      await expect(oldPage.getByRole("button", { name: "Print / Save PDF", exact: true })).toHaveCount(0);
    } finally {
      await Promise.all([oldContext.close(), newContext.close()]);
    }
  } finally {
    const history = await firestore.collection("memberHistory").where("memberId", "==", id).get();
    await Promise.all([member.delete(), consent.delete(), ...history.docs.map(item => item.ref.delete())]);
  }
});
