import { expect, test, type BrowserContext } from "@playwright/test";
import { acquireParentConsentSettingLock } from "./helpers/parent-consent-setting";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { persistedAudienceMemberIds } from "./support/event-audience-assertions";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com";

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
