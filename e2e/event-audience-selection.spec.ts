Warning: truncated output (original token count: 3449)
Total output lines: 225

import { expect, test, type Page } from "@playwright/test";
import { acquireParentConsentSettingLock, setParentConsentEnabled } from "./helpers/parent-consent-setting";

const password = process.env.E2E_TEST_USER_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL;
let releaseConsentSettingLock: (() => Promise<void>) | null = null;

test.beforeEach(async ({ browser }, testInfo) => {
  if (!testInfo.title.startsWith("selected-member event audience") || !password) return;
  releaseConsentSettingLock = await acquireParentConsentSettingLock();
  await setParentConsentEnabled(browser, true);
});

test.afterEach(async ({ browser }, testInfo) => {
  if (!testInfo.title.startsWith("selected-member event audience") || !password) return;
  try {
    await setParentConsentEnabled(browser, false);
  } finally {
    await releaseConsentSettingLock?.();
    releaseConsentSettingLock = null;
  }
});

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

test("section audience bulk controls are visible buttons and preserve the restored selection and count", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Audience controls run on desktop and Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/leader/events/create");

  const audience = page.getByTestId("event-audience-builder");
  const clearSections = audience.getByRole("button", { name: "Clear sections", exact: true });
  const selectSections = audience.getByRole("button", { name: "Select all authorized sections", exact: true });
  await expect(clearSections).toHaveAttribute("type", "button");
  await expect(clearSections).toHaveClass(/MuiButton-contained/);
  await expect(clearSections).toHaveClass(/MuiButton-colorSecondary/);
  await expect(clearSections).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(selectSections).toHaveAttribute("type", "button");
  await expect(selectSections).toHaveClass(/MuiButton-contained/);
  await expect(selectSections).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(clearSections).toHaveCSS("min-height", "44px");
  await expect(selectSections).toHaveCSS("min-height", "44px");
  for (const control of [clearSections, selectSections]) {
    const background = await control.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(background).not.toBe("rgba(0, 0, 0, 0)");
  }
  await expect(selectSections).toBeVisible();

  const sectionCheckboxes = audience.getByRole("checkbox");
  const count = await sectionCheckboxes.count();
  expect(count).…1449 tokens truncated…l({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sent: 3, skipped: 0 }) });
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
  await expect(page).toHaveURL(/\/leader\/events$/);
  await page.goto(eventUrl);
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
  await expect(page).toHaveURL(/\/leader\/events$/);
  await page.goto(eventUrl);
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByTestId(`event-record-${eventId}`)).toContainText("2 invited");
  expect(await persistedAudienceMemberIds(eventId)).toEqual(["TEST_member_beaver_01", "TEST_member_scout_01"].sort());
  await page.reload();
  await expect(page.getByTestId(`event-record-${eventId}`)).toContainText("2 invited");
});

