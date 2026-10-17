import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
const email = process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com";
const eventPath = "/leader/events/TEST_flow_event_beavers_open";
async function selectMode(page: Page, redesigned: boolean) {
  await page.goto("/leader/settings");
  const option = page.getByRole("button", { name: `${redesigned ? "Redesigned" : "Existing"} navigation`, exact: true });
  await expect(option).toBeEnabled();
  if (await option.getAttribute("aria-pressed") !== "true") await option.click();
  await expect(option).toHaveAttribute("aria-pressed", "true");
}
async function setup(page: Page, redesigned: boolean) {
  test.skip(!password, "Configure canonical E2E credentials.");
  await loginAsLeader(page, { email, password: password! });
  await selectMode(page, redesigned);
}
for (const redesigned of [false, true]) {
  test.describe(`${redesigned ? "Redesigned" : "Existing"} return navigation`, () => {
    test.afterEach(async ({ page }) => { if (password) await selectMode(page, false); });

    test("categories do not add history; browser Back follows menu, record and edit pages", async ({ page }, testInfo) => {
      await setup(page, redesigned);
      await page.goto("/leader");
      await expect(page.getByTestId("admin-overview")).toBeVisible();
      await page.locator('button[aria-controls="leader-navigation"]').click();
      const root = page.getByTestId(redesigned ? "leader-navigation-redesigned" : testInfo.project.name === "mobile-chromium" ? "leader-navigation-mobile" : "leader-navigation-desktop");
      await expect(root).toBeVisible();
      const history = () => page.evaluate(() => ({ length: window.history.length, index: window.history.state.idx, url: window.location.href }));
      // Wait for the menu's single transient entry before testing categories.
      await expect(page.locator('button[aria-controls="leader-navigation"]')).toHaveAttribute("aria-expanded", "true");
      const before = await history();
      if (redesigned || testInfo.project.name === "mobile-chromium") {
        const category = (id: string, label: string) => redesigned ? root.locator(`button[aria-controls="redesigned-${id}-panel"]`) : root.getByRole("button", { name: label, exact: true });
        await category("people-parents", "People & Parents").click();
        await category("programme", "Programme").click();
        await expect(root.locator('button[aria-expanded="true"]')).toHaveCount(1);
      }
      expect(await history()).toEqual(before);
      await root.getByTestId("leader-nav-events-activities").click();
      await expect(page).toHaveURL(/\/leader\/events$/);
      await page.getByTestId("event-card-TEST_flow_event_beavers_open").click();
      await expect(page.getByTestId("event-record-TEST_flow_event_beavers_open")).toBeVisible();
      await page.getByRole("link", { name: "Edit Event", exact: true }).click();
      await expect(page.getByLabel("Event title")).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`${eventPath}$`));
      await page.goBack();
      await expect(page).toHaveURL(/\/leader\/events$/);
      await page.goBack();
      await expect(page).toHaveURL(/\/leader$/);
      await expect(page.getByTestId("admin-overview")).toBeVisible();
    });

    test("Join Us Back preserves the dirty guard, Stay draft and explicit discard", async ({ page }) => {
      await setup(page, redesigned);
      await page.goto("/leader/join");
      await page.getByTestId("join-record-TEST_flow_join_contacted").click();
      const notes = page.getByPlaceholder("Internal notes about this joining enquiry...");
      await expect(notes).toBeVisible();
      const recordUrl = page.url();
      const original = await notes.inputValue();
      const draft = `${original}\nSW-184 unsaved ${Date.now()}`;
      await notes.fill(draft);
      await page.getByRole("button", { name: "Back to enquiries", exact: true }).click();
      const dialog = page.getByRole("dialog", { name: "Unsaved Join Us changes" });
      await expect(dialog).toBeVisible();
      await expect(page).toHaveURL(recordUrl);
      await dialog.getByRole("button", { name: "Stay", exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(notes).toHaveValue(draft);
      await page.getByRole("button", { name: "Back to enquiries", exact: true }).click();
      await dialog.getByRole("button", { name: "Leave without saving", exact: true }).click();
      await expect(page).toHaveURL(/\/leader\/join$/);
      await expect(page.getByTestId("page-join-management")).toBeVisible();
      await page.goto(recordUrl);
      await expect(notes).toHaveValue(original);
    });

    test("record links preserve modified clicks and reload uses its safe parent", async ({ page }) => {
      await setup(page, redesigned);
      await page.goto("/leader/events?section=Beavers");
      await page.getByTestId("event-card-TEST_flow_event_beavers_open").click();
      await expect(page.getByTestId("event-record-TEST_flow_event_beavers_open")).toBeVisible();
      const back = page.getByRole("link", { name: "Back to Events", exact: true });
      const popupPromise = page.context().waitForEvent("page");
      await back.click({ modifiers: ["Control"] });
      const popup = await popupPromise;
      try { await expect(popup).toHaveURL(/\/leader\/events$/); } finally { await popup.close(); }
      await expect(page).toHaveURL(new RegExp(`${eventPath}$`));
      await back.click();
      await expect(page).toHaveURL(/\/leader\/events\?section=Beavers$/);
      await page.goto(eventPath);
      await expect(page.getByTestId("event-record-TEST_flow_event_beavers_open")).toBeVisible();
      await page.reload();
      await expect(back).toBeVisible();
      await page.evaluate(() => window.history.replaceState({ ...window.history.state, idx: 7 }, "", window.location.href));
      await back.click();
      await expect(page).toHaveURL(/\/leader\/events$/);
      await expect(page.getByTestId("event-card-TEST_flow_event_beavers_open")).toBeVisible();
    });
  });
}
