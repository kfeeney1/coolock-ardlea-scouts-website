import { expect, test, type TestInfo } from "@playwright/test";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Authenticated role checks run once on desktop Chromium.");
}

async function loginLeader(page: import("@playwright/test").Page) {
  const email = process.env.E2E_LEADER_EMAIL?.trim();
  const password = process.env.E2E_LEADER_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
  test.skip(!email || !password, "Configure the seeded E2E leader account to run this check.");
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("attendance insights rejects unauthenticated users", async ({ page }) => {
  await page.goto("/leader/attendance");
  await expect(page).toHaveURL(/\/leader\/login$/);
  await expect(page.getByRole("heading", { name: "Leader Login" })).toBeVisible();
});

test("ordinary leader can search members and inspect meeting or event attendance", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await loginLeader(page);

  await page.getByRole("button", { name: /Leader Menu/ }).click();
  await page.getByRole("link", { name: "Attendance Insights" }).click();
  await expect(page).toHaveURL(/\/leader\/attendance$/);
  await expect(page.getByRole("heading", { name: "Attendance History & Insights" })).toBeVisible();
  await expect(page.getByText(/Scope:/)).toContainText("Scouts");

  const search = page.getByLabel("Search members");
  await search.fill("Casey Carroll Scouts 01");
  const cards = page.getByTestId("attendance-member-card");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText("Casey Carroll Scouts 01");
  await cards.first().getByRole("button", { name: "View attendance" }).click();

  const detail = page.getByTestId("attendance-member-detail");
  await expect(detail.getByRole("heading", { name: "Casey Carroll Scouts 01" })).toBeVisible();
  await expect(detail.getByRole("button", { name: /Meetings \(/ })).toBeVisible();
  await expect(detail.getByTestId("attendance-history-list")).toContainText("15 Jan 2099");
  await expect(detail.getByTestId("attendance-history-list")).toContainText("Attended");

  await detail.getByRole("button", { name: /Events \(/ }).click();
  await expect(detail.getByRole("button", { name: /Events \(/ })).toHaveAttribute("class", /MuiButton-contained/);
  await detail.getByRole("button", { name: "Back to members" }).click();
  await expect(search).toHaveValue("Casey Carroll Scouts 01");
});
