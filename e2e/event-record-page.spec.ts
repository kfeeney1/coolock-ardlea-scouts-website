import { expect, test, type BrowserContext, type TestInfo } from "@playwright/test";
import { acquireParentConsentSettingLock } from "./helpers/parent-consent-setting";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Event record navigation runs once on desktop Chromium.");
}

const adminEmail = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com";

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

test("clicking an event tile opens its full record with a clear list action", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events");

  const card = page.getByTestId("event-card-TEST_flow_event_beavers_open");
  await expect(card).toHaveAttribute("href", "/leader/events/TEST_flow_event_beavers_open");
  await expect(card.getByText("Open event", { exact: true })).toBeVisible();
  await expect(card).toContainText(/\d{2}-\d{2}-\d{4}/);
  await expect(card).not.toContainText(/\d{4}-\d{2}-\d{2}/);
  await card.click();

  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);
  const eventRecord = page.getByTestId("event-record-TEST_flow_event_beavers_open");
  await expect(eventRecord).toBeVisible();
  await expect(eventRecord).toContainText(/\d{2}-\d{2}-\d{4}/);
  await expect(eventRecord).not.toContainText(/\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("heading", { name: "TEST Beavers Open Day Trip" })).toBeVisible();
  const backToEvents = page.getByRole("link", { name: "Back to Events", exact: true });
  await expect(backToEvents).toHaveAttribute("href", "/leader/events");
  const backBox = await backToEvents.boundingBox();
  expect(backBox?.height).toBeGreaterThanOrEqual(44);
  await backToEvents.focus();
  await expect(backToEvents).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/leader\/events$/);
  await page.goto("/leader/events/TEST_flow_event_beavers_open");
  await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);
  await expect(page.getByRole("button", { name: "Attendance", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage Consent", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Record Badgework", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gallery", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Equipment", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Report", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit Event", exact: true })).toBeVisible();
});

test("event editor saves valid edits before app and browser back navigation", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");
  const title = `TEST event autosave ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-05-10");
  await page.getByRole("button", { name: "Create Event", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events\/(?!create$)[^/]+$/);
  const eventUrl = page.url();
  const eventId = new URL(eventUrl).pathname.split("/").pop()!;
  const persistedIds = await persistedAudienceMemberIds(eventId);
  expect(persistedIds.length).toBeGreaterThan(0);
  await expect(page.getByTestId(`event-record-${eventId}`)).toContainText(`${persistedIds.length} invited`);
  const eventPath = new URL(eventUrl).pathname;
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/edit$`));
  await expect(page.getByRole("heading", { name: new RegExp(`Edit event · ${title}`) })).toBeVisible();
  await page.getByLabel("Event title").fill("");
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  let leaveDialog = page.getByRole("alertdialog", { name: "Unsaved event changes" });
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(leaveDialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/edit$`));
  await expect(page.getByRole("alert").filter({ hasText: "Event title and start date are required" })).toBeVisible();
  const updatedTitle = `${title} updated`;
  await page.getByLabel("Event title").fill(updatedTitle);
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  leaveDialog = page.getByRole("alertdialog", { name: "Unsaved event changes" });
  await leaveDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  const browserBackTitle = `${updatedTitle} browser back`;
  await page.getByLabel("Event title").fill(browserBackTitle);
  await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.stringify(window.history.state))).toContain("__eventEditBackGuard");
  await page.goBack();
  leaveDialog = page.getByRole("alertdialog", { name: "Unsaved event changes" });
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByRole("heading", { name: browserBackTitle })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: browserBackTitle })).toBeVisible();

});

test("event leader attendance persists independently across reload", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");
  const title = `TEST leader attendance persistence ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-05-12");
  await page.getByRole("button", { name: "Create Event", exact: true }).click();
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  const leaderPanel = page.getByTestId("leader-attendance-section");
  await expect(leaderPanel.getByRole("heading", { name: "Leader Attendance" })).toBeVisible();
  await leaderPanel.getByLabel("Search active leaders").fill("Beavers Assistant Section Leader");
  await expect(leaderPanel.getByText("Beavers Assistant Section Leader", { exact: true })).toBeVisible();
  const helperRow = leaderPanel.getByTestId("leader-attendance-row").filter({ hasText: "Beavers Assistant Section Leader" });
  if (await helperRow.count() === 0) await leaderPanel.getByRole("button", { name: "Add Beavers Assistant Section Leader" }).click();
  await helperRow.getByRole("combobox", { name: "Leader attendance" }).click();
  await page.getByRole("option", { name: "Present", exact: true }).click();
  await page.getByRole("button", { name: "Save Attendance" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Attendance and consent roster updated." })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  const restoredHelper = page.getByTestId("leader-attendance-section").getByTestId("leader-attendance-row").filter({ hasText: "Beavers Assistant Section Leader" });
  await expect(restoredHelper.getByRole("combobox", { name: "Leader attendance" })).toHaveText("Present");
});

test("mobile event editor saves valid edits before navigating away", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Event auto-save mobile regression runs on the canonical mobile project.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");
  const title = `TEST mobile event autosave ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-05-11");
  await page.getByRole("button", { name: "Create Event", exact: true }).click();
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  const updatedTitle = `${title} updated`;
  await page.getByLabel("Event title").fill(updatedTitle);
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  const leaveDialog = page.getByRole("alertdialog", { name: "Unsaved event changes" });
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
});

test("blocked event report pop-ups use in-page error feedback", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/TEST_flow_event_beavers_open");

  await page.evaluate(() => {
    window.open = () => null;
  });
  await page.getByRole("button", { name: "Report", exact: true }).click();

  await expect(page.getByRole("alert").filter({ hasText: "Please allow pop-ups for this site to print the event report." })).toBeVisible();
});


test("Add Event opens the dedicated full-page editor on desktop and mobile", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events");
  await page.getByRole("link", { name: "Add Event", exact: true }).click();

  await expect(page).toHaveURL(/\/leader\/events\/create$/);
  await expect(page.getByTestId("event-create-page")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create Event" })).toBeVisible();
  await expect(page.getByTestId("event-editor-dialog")).toHaveCount(0);
  await expect(page.getByLabel("Event title")).toBeVisible();
  await expect(page.getByText("Event audience", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Clear resets the full-page event form without persisting or leaving it", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");
  await page.getByLabel("Event title").fill("TEST clear-only event");
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-04-02");
  await page.getByLabel("Location").fill("Temporary location");
  await page.getByLabel("Description").fill("Temporary description");
  await page.getByRole("button", { name: "Clear", exact: true }).click();

  await expect(page).toHaveURL(/\/leader\/events\/create$/);
  await expect(page.getByLabel("Event title")).toHaveValue("");
  await expect(page.getByRole("textbox", { name: /^Start date/ })).toHaveValue("");
  await expect(page.getByLabel("Location")).toHaveValue("");
  await expect(page.getByLabel("Description")).toHaveValue("");
});

test("Back and Cancel avoid empty events and save a valid draft before leaving", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");
  await page.getByRole("button", { name: "Back to Events", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events$/);

  await page.getByRole("link", { name: "Add Event", exact: true }).click();
  const title = `TEST cancelled event ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-04-05");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events$/);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
});

test("full-page Create Event preserves fields and audience and saves to the event record", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");

  const title = `TEST full-page event ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByRole("combobox", { name: "Event type" }).click();
  await page.getByRole("option", { name: "Day Trip", exact: true }).click();
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Beavers", exact: true }).click();
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-05-10");
  await page.getByRole("textbox", { name: "End date", exact: true }).fill("10-05-2099");
  await page.getByLabel("Location").fill("TEST full-page location");
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Open", exact: true }).click();
  await page.getByLabel("Event consent required").check();
  await page.getByLabel("Meeting / departure details").fill("TEST departure");
  await page.getByLabel("Return / collection details").fill("TEST return");
  await page.getByLabel("Description").fill("TEST event description");
  await page.getByLabel("Leader notes").fill("TEST leader notes");

  await page.getByRole("button", { name: "Clear sections", exact: true }).click();
  await page.getByRole("checkbox", { name: /^Beavers \(\d+\)$/ }).check();
  await expect(page.getByTestId("event-audience-summary")).toContainText(/Audience: Beavers — \d+ members/);
  await page.getByRole("button", { name: "Create Event", exact: true }).click();

  await expect(page).toHaveURL(/\/leader\/events\/[^/]+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByText("TEST full-page location", { exact: true })).toBeVisible();
  const eventId = page.url().split("/").at(-1)!;
  await page.goto(`/leader/events/${encodeURIComponent(eventId)}/edit`);
  await expect(page.getByRole("textbox", { name: /^Start date/ })).toHaveValue("10-05-2099");
  const savedEnd = page.getByRole("textbox", { name: "End date", exact: true });
  await expect(savedEnd).toHaveValue("10-05-2099");
  await page.getByRole("button", { name: "Choose end date" }).click();
  const endCalendar = page.getByRole("dialog", { name: "Choose end date" });
  await endCalendar.getByRole("button", { name: "Select 11-05-2099" }).click();
  await endCalendar.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(savedEnd).toHaveValue("10-05-2099");
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-05-11");
  await expect(page.getByRole("textbox", { name: "End date", exact: true })).toHaveValue("");
  await page.getByRole("textbox", { name: "End date", exact: true }).fill("09-05-2099");
  await page.getByRole("button", { name: "Save Event", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "End date cannot be before the start date" })).toContainText("End date cannot be before the start date");
});

test("direct Create Event route remains protected", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.goto("/leader/events/create");
  await expect(page).toHaveURL(/\/leader\/login/);
  await expect(page.getByLabel("Email address")).toBeVisible();
});

test("Super Admin hides and restores an event while ordinary admins lose record and list access", async ({ page, browser }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  const db = scheduleFixtureDb();
  const consentSettings = db.doc("siteSettings/parentConsent");
  const publicNavigation = db.doc("siteSettings/publicNavigation");
  const releaseConsentSettingLock = await acquireParentConsentSettingLock();
  let restoreConsentSettings: (() => Promise<unknown>) | undefined;
  let parentContext: BrowserContext | undefined;
  let ordinaryContext: BrowserContext | undefined;
  try {
    const previousSettings = await db.getAll(consentSettings, publicNavigation);
    if (previousSettings.some((snapshot) => snapshot.get("parentConsentEnabled") !== true)) {
      restoreConsentSettings = () => {
        const batch = db.batch();
        for (const snapshot of previousSettings) {
          const data = snapshot.data();
          if (data) batch.set(snapshot.ref, data);
          else batch.delete(snapshot.ref);
        }
        return batch.commit();
      };
      await db.batch()
        .set(consentSettings, { parentConsentEnabled: true }, { merge: true })
        .set(publicNavigation, { parentConsentEnabled: true }, { merge: true })
        .commit();
    }
    await loginAsLeader(page, {email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password!});
    await page.goto("/leader/events/create");
    const title = `TEST visibility ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByRole("textbox", {name: /^Start date/}).fill("2099-05-10");
  await page.getByRole("combobox", {name: "Section", exact: true}).click();
  await page.getByRole("option", {name: "Beavers", exact: true}).click();
  await page.getByRole("combobox", {name: "Status", exact: true}).click();
  await page.getByRole("option", {name: "Open", exact: true}).click();
  await page.getByRole("switch", {name: "Event consent required"}).check();
  await page.getByRole("button", {name: "Create Event", exact: true}).click();
  await expect(page.getByRole("heading", {name: title, exact: true})).toBeVisible();
  const eventUrl = page.url();
  const eventId = new URL(eventUrl).pathname.split("/").pop()!;
  const originalAudience = await persistedAudienceMemberIds(eventId);
  await page.getByRole("link", {name: "Manage Consent", exact: true}).click();
  await page.getByRole("button", {name: "Create Parent Link", exact: true}).click();
  await expect(page.getByRole("alert").filter({hasText: "Parent consent link is ready."})).toBeVisible();
  const project = process.env.VITE_FIREBASE_PROJECT_ID || "demo-coolock-ardlea-scouts";
  const record = await fetch(`http://127.0.0.1:8080/v1/projects/${project}/databases/(default)/documents/events/${eventId}`,
    {headers: {Authorization: "Bearer owner"}});
  expect(record.ok).toBe(true);
  const consentToken = (await record.json()).fields.consentLinkToken.stringValue;
  await page.goto(eventUrl);
  parentContext = await browser.newContext({baseURL: new URL(eventUrl).origin, viewport: page.viewportSize() || undefined});
  const parentPage = await parentContext.newPage();
  await parentPage.goto("/parent");
  await parentPage.getByLabel("Email", {exact: true}).fill(process.env.E2E_PARENT_EMAIL || "test.beaver.parent1@example.com");
  await parentPage.getByLabel("Password", {exact: true}).fill(password!);
  await parentPage.getByRole("button", {name: "Sign In", exact: true}).click();
  await expect(parentPage.locator("#parent-event-consent").getByText(title, {exact: true})).toBeVisible();
  const consentPage = await parentContext.newPage();
  await consentPage.goto(`/event-consent/${consentToken}`);
  await expect(consentPage.getByRole("heading", {name: title, exact: true})).toBeVisible();

  ordinaryContext = await browser.newContext({baseURL: new URL(eventUrl).origin, viewport: page.viewportSize() || undefined});
  const ordinaryPage = await ordinaryContext.newPage();
    await loginAsLeader(ordinaryPage, {email: adminEmail, password: password!});
    await ordinaryPage.goto(eventUrl);
    await expect(ordinaryPage.getByRole("heading", {name: title, exact: true})).toBeVisible();
    await expect(ordinaryPage.getByRole("button", {name: "Hide Event", exact: true})).toHaveCount(0);
    await page.getByRole("button", {name: "Hide Event", exact: true}).click();
    const confirmation = page.getByRole("dialog").filter({hasText: "Hide this event from parents and ordinary leaders?"});
    await expect(confirmation).toContainText(title);
    await confirmation.getByRole("button", {name: "Hide Event", exact: true}).click();
    await expect(page.getByTestId("event-hidden-banner")).toBeVisible();
    await expect(parentPage.getByText(title, {exact: true})).toHaveCount(0);
    await expect(consentPage.getByRole("heading", {name: title, exact: true})).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId("event-hidden-banner")).toBeVisible();
    await expect(ordinaryPage.getByRole("heading", {name: "Event Record", exact: true})).toBeVisible();
    await ordinaryPage.reload();
    await expect(ordinaryPage.getByRole("heading", {name: "Event Record", exact: true})).toBeVisible();
    await expect(ordinaryPage.getByRole("heading", {name: title, exact: true})).toHaveCount(0);
    await ordinaryPage.goto("/leader/events");
    await expect(ordinaryPage.getByRole("heading", {name: "Events & Activities", exact: true})).toBeVisible();
    await expect(ordinaryPage.getByTestId(`event-card-${eventId}`)).toHaveCount(0);
    await page.getByRole("button", {name: "Show Event", exact: true}).click();
    await page.getByRole("dialog").filter({hasText: "Restore this event to normal visibility?"})
      .getByRole("button", {name: "Show Event", exact: true}).click();
    await expect(page.getByTestId("event-hidden-banner")).toHaveCount(0);
    await ordinaryPage.reload();
    await expect(ordinaryPage.getByTestId(`event-card-${eventId}`)).toBeVisible();
    await ordinaryPage.goto(eventUrl);
    await expect(ordinaryPage.getByRole("heading", {name: title, exact: true})).toBeVisible();
    expect(await persistedAudienceMemberIds(eventId)).toEqual(originalAudience);
    await parentPage.reload();
    await expect(parentPage.locator("#parent-event-consent").getByText(title, {exact: true})).toBeVisible();
    await consentPage.reload();
    await expect(consentPage.getByRole("heading", {name: title, exact: true})).toBeVisible();
  } finally {
    try {
      await restoreConsentSettings?.();
    } finally {
      try {
        await Promise.all([ordinaryContext?.close(), parentContext?.close()]);
      } finally {
        await releaseConsentSettingLock();
      }
    }
  }
});
