import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Programme Library journey runs once on desktop Chromium.");
}

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(leaderEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function openOrCreate(page: Page) {
  await page.goto("/leader/weekly");
  const existing = page.getByRole("button", { name: /6 May 2099 · Scouts/ });
  if (await existing.count()) await existing.first().click();
  else {
    await page.getByLabel("Meeting date").fill("2099-05-06");
    await page.getByRole("button", { name: "Create Meeting" }).click();
  }
  if (!(await page.getByRole("heading", { name: "Programme Planner" }).isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Programme", exact: true }).click();
  }
}

test("leader can save, insert and remove a reusable programme activity", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page);
  await openOrCreate(page);

  const panel = page.getByTestId("programme-library-panel");
  await expect(panel).toBeVisible();

  const firstActivity = page.getByTestId("activity-plan-row").first();
  await firstActivity.getByLabel("Activity 1").fill("Library Capture the Flag");
  await firstActivity.getByLabel("Equipment 1").fill("Cones and bibs");
  await firstActivity.getByLabel("Activity duration (minutes) 1").fill("20");

  await panel.getByLabel("Save activity / game").click();
  await page.getByRole("option", { name: "Library Capture the Flag" }).click();
  await panel.getByRole("button", { name: "Save activity" }).click();
  await expect(panel.getByText(/saved to the Scouts programme library/)).toBeVisible();

  await panel.getByLabel("Saved programme item").click();
  await page.getByRole("option", { name: /Activity · Library Capture the Flag/ }).click();
  const before = await page.getByTestId("activity-plan-row").count();
  await panel.getByRole("button", { name: "Add to meeting" }).click();
  await expect(page.getByTestId("activity-plan-row")).toHaveCount(before + 1);
  await expect(page.getByTestId("activity-plan-row").last().getByLabel(`Activity ${before + 1}`)).toHaveValue("Library Capture the Flag");

  await panel.getByRole("button", { name: "Remove" }).click();
  await expect(panel.getByText(/removed from the programme library/)).toBeVisible();
});