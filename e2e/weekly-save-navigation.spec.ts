import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
const meetingDate = "2099-04-01";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Weekly save navigation runs once on desktop Chromium.");
}

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(leaderEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("saving a meeting returns to the meetings landing page", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page);
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Weekly Meetings" })).toBeVisible();

  const existingOpen = page.getByRole("button", { name: /1 Apr 2099 · Scouts/ });
  const existingClosed = page.getByTestId(/meeting-history-/).filter({ hasText: "1 Apr 2099 · Scouts" });

  if (await existingOpen.count()) {
    await existingOpen.first().click();
  } else if (await existingClosed.count()) {
    await existingClosed.first().getByRole("button", { name: "View / Edit" }).click();
    if (await page.getByRole("button", { name: "Reopen Meeting" }).count()) {
      await page.getByRole("button", { name: "Reopen Meeting" }).click();
    }
  } else {
    await page.getByLabel("Meeting date").fill(meetingDate);
    await page.getByRole("button", { name: "Create Meeting" }).click();
  }

  await expect(page.getByRole("button", { name: "Save Meeting" })).toBeVisible();
  await page.getByRole("button", { name: "Save Meeting" }).click();

  await expect(page.getByText("Meeting saved.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create Meeting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Open Meeting" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meeting History" })).toBeVisible();
  await expect(page.getByRole("button", { name: /1 Apr 2099 · Scouts/ })).toBeVisible();
});
