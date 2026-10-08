import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const scoutMemberName = "Casey OBrien Scouts 01";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Weekly meeting history access runs once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("programme scouter can view past meetings but cannot edit", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page, leaderEmail!);
  await page.goto("/leader/weekly");
  const historyCard = page.getByTestId(/meeting-history-/).filter({ hasText: "· Scouts" }).first();
  const viewButton = historyCard.getByRole("button", { name: "View", exact: true });
  await expect(viewButton).toBeVisible();
  await viewButton.click();
  await expect(page.getByTestId("past-meeting-edit-notice")).toContainText("read-only");
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(page.getByRole("checkbox", { name: scoutMemberName, exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Programme", exact: true }).click();
  await expect(page.getByLabel("Theme")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Save Meeting", exact: true })).toHaveCount(0);
});

test("group secretary can view all meeting history but cannot edit", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure canonical E2E password.");

  await login(page, "test.group.secretary@example.com");
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Create Meeting" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Meeting History" })).toBeVisible();
  await expect(page.getByText(/· Beavers$/).first()).toBeVisible();
  await expect(page.getByText(/· Rovers$/).first()).toBeVisible();
});

test("SW-322 Meeting History filters stay compact and usable on desktop and mobile", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Meeting History filter layout runs on desktop and Pixel 7 Chromium.");
  test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");

  await login(page, adminEmail!);
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Meeting History" })).toBeVisible();

  const historyCard = page.getByRole("heading", { name: "Meeting History" }).locator("xpath=..");
  const search = page.getByLabel("Search meeting history");
  const section = page.getByLabel("Meeting history section");
  const fromDate = page.getByLabel("From date");
  const toDate = page.getByLabel("To date");
  await expect(search).toBeVisible();
  await expect(section).toBeVisible();
  await expect(fromDate).toBeVisible();
  await expect(toDate).toBeVisible();

  const searchBounds = await search.boundingBox();
  const sectionBounds = await section.boundingBox();
  const viewportWidth = page.viewportSize()?.width ?? 0;
  const cardBounds = await historyCard.boundingBox();
  expect(searchBounds).not.toBeNull();
  expect(sectionBounds).not.toBeNull();
  expect(cardBounds).not.toBeNull();
  expect(viewportWidth).toBeGreaterThan(0);

  if (testInfo.project.name === "mobile-chromium") {
    expect(sectionBounds!.y - (searchBounds!.y + searchBounds!.height)).toBeLessThan(96);
  } else {
    expect(Math.abs(sectionBounds!.y - searchBounds!.y)).toBeLessThan(80);
  }

  const expectControlsInsideCard = async (controls: Locator[]) => {
    const bounds = await Promise.all(controls.map((control) => control.boundingBox()));
    for (const box of bounds) {
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(cardBounds!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(cardBounds!.x + cardBounds!.width + 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
    }
  };
  await expectControlsInsideCard([search, section, fromDate, toDate]);

  await search.focus();
  await search.press("Tab");
  await expect(section).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(fromDate).toBeFocused();
  const focusTargets = [search, section, fromDate, toDate];
  const expectedFocusOrder = await Promise.all(focusTargets.map((control) => control.getAttribute("id")));
  const actualFocusOrder = await historyCard.locator('[data-testid="weekly-history-search"], #weekly-history-section, input[type="date"]').evaluateAll((controls) => controls.map((control) => control.id));
  expect(actualFocusOrder).toEqual(expectedFocusOrder);
  const tabStops = await Promise.all(focusTargets.map((control) => control.evaluate((element) => element.tabIndex)));
  expect(tabStops).toEqual([0, 0, 0, 0]);

  const resultCount = page.getByTestId("weekly-history-result-count");
  await search.fill("Scout Den");
  await expect(resultCount).toContainText(/Showing [1-9]\d* of \d+ closed meetings/);
  await search.fill("No matching meeting 900000");
  await expect(page.getByTestId("weekly-history-no-results")).toBeVisible();
  await search.fill("");

  await section.click();
  await page.getByRole("option", { name: "Beavers", exact: true }).click();
  await expect(page.locator('[data-testid^="meeting-history-"][data-section="Beavers"]').first()).toBeVisible();
  await expect(page.locator('[data-testid^="meeting-history-"][data-section="Rovers"]')).toHaveCount(0);
  await section.click();
  await page.getByRole("option", { name: "Cubs", exact: true }).click();
  await expect(page.locator('[data-testid^="meeting-history-"][data-section="Cubs"]').first()).toBeVisible();
  await expect(page.locator('[data-testid^="meeting-history-"][data-section="Beavers"]')).toHaveCount(0);

  await fromDate.fill("2100-01-01");
  await expect(page.getByTestId("weekly-history-no-results")).toBeVisible();
  await fromDate.fill("2099-01-01");
  await toDate.fill("2099-12-31");
  await expect(page.locator('[data-testid^="meeting-history-"][data-section="Cubs"]').first()).toBeVisible();
  const reset = page.getByTestId("weekly-history-reset");
  await expect(reset).toBeVisible();
  await expectControlsInsideCard([search, section, fromDate, toDate, reset]);
  await reset.click();

  await expect(search).toHaveValue("");
  await expect(section).toContainText("All sections");
  await expect(fromDate).toHaveValue("");
  await expect(toDate).toHaveValue("");
  await expect(reset).toHaveCount(0);
  await expect(page.locator('[data-testid^="meeting-history-"]')).not.toHaveCount(0);
});
