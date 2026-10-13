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
  await page.getByRole("switch", { name: "Event consent required" }).check();
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
  await expect(page.getByRole("status").filter({ hasText: "Unsaved changes" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.stringify(window.history.state))).toContain("__eventEditBackGuard");
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

});

test("SW-383 first entry, direct URLs, reload, and event switches use the saved event baseline", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);

  const firstTitle = `TEST SW-383 first entry ${Date.now()}`;
  const first = await createEvent(page, firstTitle);
  const firstEditUrl = `${first.eventUrl}/edit`;

  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  await expect(page).toHaveURL(firstEditUrl);
  await expect(page.getByLabel("Event title")).toHaveValue(firstTitle);
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await expect(leaveDialog(page)).toHaveCount(0);

  await page.reload();
  await expect(page.getByLabel("Event title")).toHaveValue(firstTitle);
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await expect(leaveDialog(page)).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Event", exact: true }).click();
  await expect(page).toHaveURL(first.eventUrl);
  await expect(leaveDialog(page)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: firstTitle, exact: true })).toBeVisible();

  const secondTitle = `TEST SW-383 second event ${Date.now()}`;
  const second = await createEvent(page, secondTitle);
  await page.goto(firstEditUrl);
  await expect(page.getByLabel("Event title")).toHaveValue(firstTitle);
  await expect(leaveDialog(page)).toHaveCount(0);
  await page.goto(`${second.eventUrl}/edit`);
  await expect(page.getByLabel("Event title")).toHaveValue(secondTitle);
  await expect(leaveDialog(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Event title")).toHaveValue(secondTitle);
  await expect(leaveDialog(page)).toHaveCount(0);

  // A real field edit followed immediately by a dashboard menu transition must
  // still be intercepted even if React's passive effects have not rerun yet.
  const savedStartDate = await page.getByLabel("Start date").inputValue();
  const editedStartDate = "2099-05-12";
  await page.getByLabel("Start date").fill(editedStartDate);
  // The active route changes this button's accessible name, so use its stable
  // control relationship instead of assuming the initial "Open Leader Menu" name.
  const leaderMenuButton = page.locator('button[aria-controls="leader-navigation"]');
  await leaderMenuButton.click();
  await page.getByTestId("leader-nav-dashboard").click();

  const menuLeaveDialog = leaveDialog(page);
  await expect(menuLeaveDialog).toBeVisible();
  await expect(menuLeaveDialog.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  await expect(menuLeaveDialog.getByRole("button", { name: "Discard", exact: true })).toBeVisible();
  await expect(menuLeaveDialog.getByRole("button", { name: "Stay", exact: true })).toBeVisible();
  await menuLeaveDialog.getByRole("button", { name: "Stay", exact: true }).click();
  await expect(page).toHaveURL(`${second.eventUrl}/edit`);
  await expect(page.getByLabel("Start date")).toHaveValue(editedStartDate);

  // Stay leaves the menu expanded; clicking the same route control again
  // reopens the pending navigation attempt without toggling the menu closed.
  await page.getByTestId("leader-nav-dashboard").click();
  await leaveDialog(page).getByRole("button", { name: "Discard", exact: true }).click();
  await expect(page).toHaveURL(/\/leader$/);

  await page.goto(`${second.eventUrl}/edit`);
  await expect(page.getByLabel("Start date")).toHaveValue(savedStartDate);
  await expect(leaveDialog(page)).toHaveCount(0);
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
  // Returning from the guarded editor triggers a fresh asynchronous event-record load.
  // Wait for that record rather than relying on the default 10-second assertion timeout.
  await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible({ timeout: 30_000 });
});
