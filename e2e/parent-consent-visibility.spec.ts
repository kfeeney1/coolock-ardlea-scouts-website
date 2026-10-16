import { expect, test, type TestInfo } from "@playwright/test";
import { acquireParentConsentSettingLock, setParentConsentEnabled } from "./helpers/parent-consent-setting";

const password = process.env.E2E_TEST_USER_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL || "test.beaver.parent1@example.com";
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";

async function loginParent(page: import("@playwright/test").Page) {
  await page.goto("/parent?child=TEST_member_beaver_01#parent-medical-consent");
  await page.getByLabel("Email").fill(parentEmail);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Parent Portal", exact: true })).toBeVisible();
}

test("Superuser controls Parent Portal Consent and Medical Consent entry points", async ({ page, browser }, testInfo: TestInfo) => {
  test.skip(!password, "Configure the canonical E2E password.");
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Consent visibility is checked on desktop and mobile Chromium.");
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({ width: 390, height: 844 });

  const parentContext = await browser.newContext({ baseURL });
  const parentPage = await parentContext.newPage();
  const releaseSettingLock = await acquireParentConsentSettingLock();
  if (testInfo.project.name === "mobile-chromium") await parentPage.setViewportSize({ width: 390, height: 844 });
  try {
    await setParentConsentEnabled(browser, false);
    await loginParent(parentPage);
    await expect(parentPage.getByRole("navigation", { name: "Parent Portal sections" }).getByRole("link", { name: "Consent & Medical" })).toHaveCount(0);
    await expect(parentPage.getByRole("heading", { name: "Consent & Medical Forms" })).toHaveCount(0);
    await expect(parentPage.getByTestId("parent-consent-search")).toHaveCount(0);
    await expect(parentPage.getByRole("heading", { name: "Upcoming Events & Galleries" })).toBeVisible();
    const thingsToDo = parentPage.getByTestId("parent-things-to-do");
    await expect(thingsToDo.getByText("Event consent", { exact: true })).toHaveCount(0);
    await expect(thingsToDo.getByRole("button", { name: "Review events", exact: true })).toHaveCount(0);
    await expect(thingsToDo.getByText("Upcoming events", { exact: true })).toBeVisible();
    await expect(thingsToDo.getByTestId("parent-next-action")).toHaveCount(0);
    await expect(parentPage.getByRole("link", { name: "Complete Event Consent" })).toHaveCount(0);
    await expect(parentPage.getByRole("heading", { name: "Event Galleries" })).toBeVisible();

    // A direct token route must stop before loading or rendering the public event form.
    await parentPage.goto("/event-consent/TESTFLOWBEAVERSOPEN2026");
    await expect(parentPage.getByRole("alert")).toContainText("Event consent forms are currently unavailable.");
    await expect(parentPage.getByRole("heading", { name: "TEST Beavers Open Day Trip", exact: true })).toHaveCount(0);
    await expect(parentPage.getByLabel("Young person's full name")).toHaveCount(0);

    await parentPage.goto("/parent?child=TEST_member_beaver_01");

    // A direct URL to the hidden section remains within Parent Portal but cannot
    // mount the protected consent editor or expose the linked child's record.
    await parentPage.goto("/activities/consent");
    await expect(parentPage).toHaveURL(/\/parent#parent-medical-consent$/);
    await expect(parentPage.getByRole("heading", { name: "Consent & Medical Forms" })).toHaveCount(0);
    await expect(parentPage.getByTestId("parent-consent-tile-TEST_member_beaver_01")).toHaveCount(0);

    await setParentConsentEnabled(browser, true);
    await parentPage.reload();
    const consentLink = parentPage.getByRole("navigation", { name: "Parent Portal sections" }).getByRole("link", { name: "Consent & Medical" });
    await expect(consentLink).toBeVisible();
    await expect(parentPage.getByTestId("parent-things-to-do").getByText("Event consent", { exact: true })).toBeVisible();
    await expect(parentPage.getByTestId("parent-things-to-do").getByRole("button", { name: "Review events", exact: true })).toBeVisible();
    await parentPage.goto("/event-consent/TESTFLOWBEAVERSOPEN2026");
    await expect(parentPage.getByRole("heading", { name: "TEST Beavers Open Day Trip", exact: true })).toBeVisible();
    await expect(parentPage.getByLabel("Young person's full name")).toBeVisible();
    await parentPage.goto("/parent?child=UNLINKED_MEMBER#parent-medical-consent");
    await expect(parentPage).toHaveURL(/child=TEST_member_beaver_01#parent-medical-consent$/);
    await expect(parentPage.getByRole("heading", { name: "Consent & Medical Forms" })).toBeVisible();
    await expect(parentPage.getByRole("heading", { name: "Upcoming Events & Event Consent" })).toBeVisible();
    await expect(parentPage.getByText("Dylan Dunne Beavers 03", { exact: true })).toHaveCount(0);
    await parentPage.goto("/activities/consent");
    await expect(parentPage).toHaveURL(/\/parent#parent-medical-consent$/);
    await expect(parentPage.getByRole("heading", { name: "Consent & Medical Forms" })).toBeVisible();
    await consentLink.click();
    await expect(parentPage).toHaveURL(/#parent-medical-consent$/);
    await expect(parentPage.getByRole("heading", { name: "Consent & Medical Forms" })).toBeInViewport();
    await expect(parentPage.getByTestId("parent-consent-tile-TEST_member_beaver_01")).toBeVisible();

    // A separate browser context reads the persisted projection from the server.
    const freshContext = await browser.newContext({ baseURL });
    const freshPage = await freshContext.newPage();
    try {
      if (testInfo.project.name === "mobile-chromium") await freshPage.setViewportSize({ width: 390, height: 844 });
      await freshPage.goto("/parent?child=TEST_member_beaver_01#parent-medical-consent");
      await freshPage.getByLabel("Email").fill(parentEmail);
      await freshPage.getByLabel("Password").fill(password!);
      await freshPage.getByRole("button", { name: "Sign In" }).click();
      await expect(freshPage.getByRole("heading", { name: "Consent & Medical Forms" })).toBeVisible();
      await expect(freshPage.getByTestId("parent-consent-tile-TEST_member_beaver_01")).toBeVisible();
    } finally {
      await freshContext.close();
    }

    await setParentConsentEnabled(browser, false);
    await parentPage.reload();
    await expect(parentPage.getByRole("link", { name: "Consent & Medical", exact: true })).toHaveCount(0);
    await expect(parentPage.getByRole("heading", { name: "Consent & Medical Forms" })).toHaveCount(0);
    await expect(parentPage.getByRole("heading", { name: "Upcoming Events & Galleries" })).toBeVisible();
    await expect(parentPage.getByTestId("parent-things-to-do").getByText("Upcoming events", { exact: true })).toBeVisible();
  } finally {
    await setParentConsentEnabled(browser, false);
    await parentContext.close();
    await releaseSettingLock();
  }
});
