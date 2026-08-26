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

async function ensureProgramme(page: Page) {
  const planner = page.getByRole("heading", { name: "Programme Planner" });
  if (!(await planner.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Programme", exact: true }).click();
  }
  await expect(planner).toBeVisible();
}

async function openOrCreate(page: Page, date: string, displayDate: RegExp) {
  const existingOpen = page.getByRole("button", { name: displayDate });
  const existingClosed = page.getByTestId(/meeting-history-/).filter({ hasText: displayDate });
  if (await existingOpen.count()) {
    await existingOpen.first().click();
  } else if (await existingClosed.count()) {
    await existingClosed.first().getByRole("button", { name: "View / Edit" }).click();
    if (await page.getByRole("button", { name: "Reopen Meeting" }).count()) {
      await page.getByRole("button", { name: "Reopen Meeting" }).click();
    }
  } else {
    await page.getByLabel("Meeting date").fill(date);
    await page.getByRole("button", { name: "Create Meeting" }).click();
  }
  await ensureProgramme(page);
}

test("future meeting opens in programme and saving retains the meeting editor", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page);
  await page.goto("/leader/weekly");
  await openOrCreate(page, "2099-04-01", /1 Apr 2099 · Scouts/);

  await expect(page.getByRole("heading", { name: "Programme Planner" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Badgework Plan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save Meeting" })).toBeVisible();
  await page.getByRole("button", { name: "Save Meeting" }).click();

  await expect(page.getByText("Meeting saved.")).toBeVisible();
  await expect(page.getByTestId("weekly-meeting-editor-top")).toBeVisible();
  await expect(page.getByTestId("weekly-meeting-summary")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Programme Planner" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create Meeting" })).toHaveCount(0);
});

test("activity can have multiple section leaders and badgework is planned with programme", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page);
  await page.goto("/leader/weekly");
  await openOrCreate(page, "2099-04-08", /8 Apr 2099 · Scouts/);

  const firstActivity = page.getByTestId("activity-plan-row").first();
  const sectionLeader = firstActivity.getByLabel(/Scouts Section Leader · Section Leader/);
  const programmeScouter = firstActivity.getByLabel(/Scouts Programme Scouter · Programme Scouter/);
  await sectionLeader.check();
  await programmeScouter.check();
  await expect(sectionLeader).toBeChecked();
  await expect(programmeScouter).toBeChecked();
  await expect(firstActivity.getByLabel(/Cubs Section Leader/)).toHaveCount(0);

  const badgework = page.getByTestId("badgework-plan-row").first();
  await badgework.getByLabel("Badgework 1").fill("Adventure Skills");
  await badgework.getByLabel("Badgework instructions / notes 1").fill("Work through the next practical requirement.");

  await page.getByRole("button", { name: "Save Meeting" }).click();
  await expect(page.getByText("Meeting saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Programme Planner" })).toBeVisible();

  const savedActivity = page.getByTestId("activity-plan-row").first();
  await expect(savedActivity.getByLabel(/Scouts Section Leader · Section Leader/)).toBeChecked();
  await expect(savedActivity.getByLabel(/Scouts Programme Scouter · Programme Scouter/)).toBeChecked();
  await expect(page.getByTestId("badgework-plan-row").first().getByLabel("Badgework 1")).toHaveValue("Adventure Skills");
});

test("weekly planner fits a phone viewport without horizontal overflow", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/leader/weekly");
  await openOrCreate(page, "2099-04-15", /15 Apr 2099 · Scouts/);

  await expect(page.getByRole("heading", { name: "Programme Planner" })).toBeVisible();
  await expect(page.getByTestId("weekly-step-nav")).toBeVisible();
  await expect(page.getByTestId("activity-plan-row").first()).toBeVisible();
  await expect(page.getByTestId("badgework-plan-row").first()).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
