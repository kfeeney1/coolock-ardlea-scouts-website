import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Weekly planner follow-up runs once on desktop Chromium.");
}

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(leaderEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function openOrCreate(page: Page, date: string, displayDate: RegExp) {
  const existingOpen = page.getByRole("button", { name: displayDate });
  const existingClosed = page.getByTestId(/meeting-history-/).filter({ hasText: displayDate });
  if (await existingOpen.count()) {
    await existingOpen.first().click();
    return;
  }
  if (await existingClosed.count()) {
    await existingClosed.first().getByRole("button", { name: "View / Edit" }).click();
    if (await page.getByRole("button", { name: "Reopen Meeting" }).count()) {
      await page.getByRole("button", { name: "Reopen Meeting" }).click();
    }
    return;
  }
  await page.getByLabel("Meeting date").fill(date);
  await page.getByRole("button", { name: "Create Meeting" }).click();
}

test("saving a meeting returns to the meetings landing page", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page);
  await page.goto("/leader/weekly");
  await openOrCreate(page, "2099-04-01", /1 Apr 2099 · Scouts/);

  await expect(page.getByRole("button", { name: "Save Meeting" })).toBeVisible();
  await page.getByRole("button", { name: "Save Meeting" }).click();

  await expect(page.getByText("Meeting saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create Meeting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open Meeting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meeting History" })).toBeVisible();
  await expect(page.getByRole("button", { name: /1 Apr 2099 · Scouts/ })).toBeVisible();
});

test("activity leader selector is section-scoped and supports All and Other", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page);
  await page.goto("/leader/weekly");
  await openOrCreate(page, "2099-04-08", /8 Apr 2099 · Scouts/);
  await page.getByRole("button", { name: "Programme" }).click();

  await page.getByLabel("Leader 1").click();
  await expect(page.getByRole("option", { name: "All" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Scouts Programme Scouter · Programme Scouter" })).toBeVisible();
  await expect(page.getByRole("option", { name: /Cubs Section Leader/ })).toHaveCount(0);
  await page.getByRole("option", { name: "All" }).click();

  await page.getByLabel("Leader 2").click();
  await page.getByRole("option", { name: "Other" }).click();
  await page.getByLabel("Other leader 2").fill("Guest Instructor");

  await page.getByRole("button", { name: "Save Meeting" }).click();
  await expect(page.getByRole("heading", { name: "Create Meeting" })).toBeVisible();
  await page.getByRole("button", { name: /8 Apr 2099 · Scouts/ }).click();
  await page.getByRole("button", { name: "Programme" }).click();

  await expect(page.getByRole("combobox", { name: "Leader 1" })).toHaveText("All");
  await expect(page.getByRole("combobox", { name: "Leader 2" })).toHaveText("Other");
  await expect(page.getByLabel("Other leader 2")).toHaveValue("Guest Instructor");
});
