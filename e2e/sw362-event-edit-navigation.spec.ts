import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "SW-362 desktop event editor regression runs once on Chromium.");
}

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function createEvent(page: Page, title: string) {
  await page.goto("/leader/events/create");
  await page.getByLabel("Event title").fill(title);
  await page.getByLabel("Start date").fill("2099-05-10");
  await page.getByRole("button", { name: "Create Event", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events\/(?!create$)[^/]+$/);
  return { eventUrl: page.url(), eventPath: new URL(page.url()).pathname };
}

function leaveDialog(page: Page) {
  return page.getByRole("alertdialog", { name: "Unsaved event changes" });
}

test("SW-362 existing event editor confirms, preserves drafts, and saves only on request", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);

  const title = `TEST SW-362 desktop ${Date.now()}`;
  const { eventUrl, eventPath } = await createEvent(page, title);
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  const draft = `${title} draft`;
  await page.getByLabel("Event title").fill(draft);
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();

  let dialog = leaveDialog(page);
  await expect(dialog).toBeVisible();
  const stay = dialog.getByRole("button", { name: "Stay", exact: true });
  await expect(stay).toBeFocused();
  await expect(dialog.getByRole("button", { name: "Discard", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("Event title")).toHaveValue(draft);
  await expect(page.getByRole("link", { name: "Back to Event", exact: true })).toBeFocused();

  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  dialog = leaveDialog(page);
  await dialog.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  const savedTitle = `${title} saved`;
  await page.getByLabel("Event title").fill(savedTitle);
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  dialog = leaveDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Save", exact: true }).dblclick({ delay: 20 });
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByRole("heading", { name: savedTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attendance", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage Consent", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Record Badgework", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: savedTitle })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(eventPath);

  // Returning without edits proceeds directly and leaves the persisted record alone.
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page).toHaveURL(eventUrl);

  // Browser Back first consumes the same-route guard, then displays the decision dialog.
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  const backDraft = `${savedTitle} back draft`;
  await page.getByLabel("Event title").fill(backDraft);
  await page.goBack();
  dialog = leaveDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/edit$`));
  await page.goBack();
  dialog = leaveDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByRole("heading", { name: savedTitle })).toBeVisible();

  // A failed validation keeps the invalid draft in the editor and surfaces its explanation.
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  await page.getByLabel("Event title").fill("");
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  dialog = leaveDialog(page);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/edit$`));
  await expect(page.getByLabel("Event title")).toHaveValue("");
  await expect(page.getByRole("alert").filter({ hasText: "Event title and start date are required" })).toBeVisible();
  await page.getByLabel("Event title").fill(savedTitle);
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByRole("heading", { name: savedTitle })).toBeVisible();

  // The service rejects a direct lifecycle jump; the unsaved status remains in the form.
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Completed", exact: true }).click();
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  dialog = leaveDialog(page);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/edit$`));
  await expect(page.getByRole("combobox", { name: "Status" })).toHaveText("Completed");
  await expect(page.getByRole("alert").filter({ hasText: "Unable to save this event. Your edits are still here." })).toBeVisible();
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Draft", exact: true }).click();
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByRole("heading", { name: savedTitle })).toBeVisible();
});

test("SW-362 mobile confirmation fits the screen and Android Back can be cancelled", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "SW-362 mobile regression runs on Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);

  const title = `TEST SW-362 mobile ${Date.now()}`;
  const { eventUrl, eventPath } = await createEvent(page, title);
  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  const draft = `${title} mobile draft`;
  await page.getByLabel("Event title").fill(draft);
  await page.goBack();
  const dialog = leaveDialog(page);
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const label of ["Save", "Discard", "Stay"]) {
    const bounds = await dialog.getByRole("button", { name: label, exact: true }).boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }
  await dialog.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${eventPath}/edit$`));
  await expect(page.getByLabel("Event title")).toHaveValue(draft);
  await page.goBack();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(eventUrl);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
});
