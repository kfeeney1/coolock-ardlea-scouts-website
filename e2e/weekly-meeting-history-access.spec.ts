import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
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
