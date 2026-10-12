import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL;

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function persistedAudienceMemberIds(eventId: string): Promise<string[]> {
  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || "demo-coolock-ardlea-scouts";
  const url = new URL(`http://127.0.0.1:8080/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/events/${encodeURIComponent(eventId)}/audienceMembers`);
  // Event audiences allow up to 450 members. Ask for more than that in the
  // emulator REST read so the assertion compares against the complete snapshot.
  url.searchParams.set("pageSize", "1000");
  const response = await fetch(url, { headers: { Authorization: "Bearer owner" } });
  expect(response.ok, "Firestore emulator should return persisted audience rows").toBe(true);
  const data = await response.json() as { documents?: Array<{ name: string }> };
  return (data.documents ?? []).map((document) => document.name.split("/").pop() ?? "").filter(Boolean).sort();
}

test("selected-member event audience stays exact across sections, edit, save, parent scope and reload on desktop and mobile", async ({ page, browser }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Selected-member event targeting runs on desktop Chromium and Pixel 7 Chromium.");
  test.skip(!password || !parentEmail, "Configure E2E_TEST_USER_PASSWORD and E2E_PARENT_EMAIL.");
  await loginAdmin(page);
  await page.goto("/leader/events/create");

  const title = `TEST selected audience ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByLabel("Start date").fill("2099-06-10");
  await page.getByLabel("Event consent required").check();
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Open", exact: true }).click();
  await page.getByRole("button", { name: "Selected members", exact: true }).click();
  await page.getByRole("button", { name: "Clear all members", exact: true }).click();
  const beaversSection = page.getByRole("button", { name: /^Open Beavers members/ });
  await expect(beaversSection).toBeVisible();
  await beaversSection.click();
  const beaversSearch = page.getByLabel("Search Beavers members");
  await beaversSearch.fill("Riley");
  const rileyFromSection = page.getByTestId("event-audience-member-TEST_member_beaver_01").getByRole("checkbox");
  await expect(rileyFromSection).toBeVisible();
  await rileyFromSection.check();
  await page.getByRole("button", { name: /^Open Cubs members/ }).click();
  await expect(page.getByRole("button", { name: "Remove Riley Nolan Beavers 01 from audience" })).toBeVisible();
  await page.getByRole("button", { name: "Add other group members", exact: true }).click();
  const memberSearch = page.getByLabel("Search authorized group members");
  await memberSearch.fill("Riley");
  const selectedRiley = page.getByTestId("event-audience-member-TEST_member_beaver_01").getByRole("checkbox");
  await expect(selectedRiley).toBeVisible();
  await selectedRiley.check();
  await memberSearch.fill("");
  const selectedCub = page.getByTestId("event-audience-member-TEST_member_cub_01").getByRole("checkbox");
  const selectedScout = page.getByTestId("event-audience-member-TEST_member_scout_01").getByRole("checkbox");
  await expect(selectedCub).toBeVisible();
  await expect(selectedScout).toBeVisible();
  await selectedCub.check();
  await selectedScout.check();
  const selectedNames = await Promise.all([selectedRiley, selectedCub, selectedScout].map(async (checkbox) =>
    (await checkbox.locator("xpath=ancestor::label").innerText()).split(" · ")[0]
  ));
  await expect(page.getByTestId("event-audience-summary")).toContainText("Audience: 3 selected members");
  await expect(page.getByText("Only the members selected here will be invited")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Create Event", exact: true }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const eventId = new URL(page.url()).pathname.split("/").pop()!;
  expect(await persistedAudienceMemberIds(eventId)).toEqual([
    "TEST_member_beaver_01",
    "TEST_member_cub_01",
    "TEST_member_scout_01"
  ].sort());
  await expect(page.getByTestId(`event-record-${eventId}`)).toContainText("3 invited");
  await expect(page.getByTestId("event-record-audience")).toContainText("Audience: 3 selected members");
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  const attendanceDialog = page.getByRole("dialog");
  for (const name of selectedNames) await expect(attendanceDialog.getByText(name, { exact: true })).toBeVisible();
  await expect(attendanceDialog.getByText("Morgan Kavanagh Beavers 02", { exact: true })).toHaveCount(0);
  await attendanceDialog.getByRole("button", { name: "Close", exact: true }).click();

  const eventUrl = page.url();
  await page.getByRole("link", { name: "Manage Consent", exact: true }).click();
  const consentPanel = page.locator(".MuiPaper-root").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).last();
  await expect(consentPanel).toBeVisible();
  await expect(consentPanel).toContainText("3 members");
  await consentPanel.getByRole("button", { name: "Create Parent Link", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Parent consent link is ready." })).toBeVisible();
  let notificationRequest: { eventId?: string; memberIds?: string[]; kind?: string } | undefined;
  await page.route("**/event-notification*", async (route) => {
    notificationRequest = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sent: 3, skipped: 0 }) });
  });
  await consentPanel.getByRole("button", { name: "Send Event Notice", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Event notice queued for 3 members." })).toBeVisible();
  expect(notificationRequest?.eventId).toBeTruthy();
  expect(notificationRequest?.kind).toBe("notice");
  expect(notificationRequest?.memberIds).toHaveLength(3);

  const viewport = page.viewportSize();
  const parentContext = await browser.newContext({
    viewport: viewport ?? undefined,
    isMobile: testInfo.project.name === "mobile-chromium",
    hasTouch: testInfo.project.name === "mobile-chromium"
  });
  try {
    const parentPage = await parentContext.newPage();
    await parentPage.goto(new URL("/parent", page.url()).toString());
    await parentPage.getByLabel("Email").fill(parentEmail!);
    await parentPage.getByLabel("Password").fill(password!);
    await parentPage.getByRole("button", { name: "Sign In" }).click();
    await expect(parentPage.getByText(/Your account is approved and linked to 2 member records/i)).toBeVisible();
    const childSelect = parentPage.getByRole("combobox", { name: "Viewing information for" });
    await childSelect.click();
    await parentPage.getByRole("option", { name: /Riley Nolan/ }).click();
    await expect(childSelect).toContainText("Riley Nolan");
    const parentEventSection = parentPage.locator("#parent-event-consent");
    await expect(parentEventSection).toContainText(title);
    await childSelect.click();
    await parentPage.getByRole("option", { name: /Morgan Kavanagh/ }).click();
    await expect(childSelect).toContainText("Morgan Kavanagh");
    await expect(parentPage.getByText(title, { exact: true })).toHaveCount(0);
  } finally {
    await parentContext.close();
  }

  await page.goto(eventUrl);
  await expect(page.getByTestId("event-record-audience")).toContainText("Audience: 3 selected members");

  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  await expect(page.getByTestId("event-audience-summary")).toContainText("Audience: 3 selected members");
  await page.getByLabel("Location").fill("TEST selected audience preserved");
  await page.getByRole("button", { name: "Save Event", exact: true }).click();
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByTestId("event-record-audience")).toContainText("Audience: 3 selected members");
  await page.reload();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByTestId("event-record-audience")).toContainText("Audience: 3 selected members");

  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  await page.getByRole("button", { name: "Edit selection", exact: true }).click();
  await page.getByRole("button", { name: /^Open Cubs members/ }).click();
  const cubToRemove = page.getByTestId("event-audience-member-TEST_member_cub_01").getByRole("checkbox");
  await expect(cubToRemove).toBeChecked();
  await cubToRemove.uncheck();
  await page.getByRole("button", { name: "Save Event", exact: true }).click();
  const removalConfirmation = page.getByRole("alertdialog", { name: "Confirm audience removals" });
  await expect(removalConfirmation).toContainText("remove 1 existing invitee");
  await removalConfirmation.getByRole("button", { name: "Confirm removal and save" }).click();
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByTestId(`event-record-${eventId}`)).toContainText("2 invited");
  expect(await persistedAudienceMemberIds(eventId)).toEqual(["TEST_member_beaver_01", "TEST_member_scout_01"].sort());
  await page.reload();
  await expect(page.getByTestId(`event-record-${eventId}`)).toContainText("2 invited");
});

