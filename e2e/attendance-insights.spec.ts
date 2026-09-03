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

test("ordinary leader can compare attendance sources, preserve filters through history and reset them together", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await loginLeader(page);

  await page.getByRole("button", { name: /Leader Menu|Menu ·/ }).click();
  await page.getByRole("link", { name: "Attendance Insights" }).click();
  await expect(page).toHaveURL(/\/leader\/attendance$/);
  await expect(page.getByRole("heading", { name: "Attendance History & Insights" })).toBeVisible();
  await expect(page.getByText(/Scope:/)).toContainText("Scouts");
  await expect(page.getByTestId("meeting-average-rate")).toContainText("Average meeting attendance");
  await expect(page.getByTestId("event-average-rate")).toContainText("Average event attendance");
  await expect(page.getByTestId("combined-average-rate")).toContainText("Average combined attendance");

  const seededMember = "Casey OBrien Scouts 01";
  const search = page.getByLabel("Search members");
  await search.fill(seededMember);
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Scouts" }).click();
  const cards = page.getByTestId("attendance-member-card");
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toContainText(seededMember);
  await expect(cards.first()).toContainText("Meetings");
  await expect(cards.first()).toContainText("Events");
  await expect(cards.first()).toContainText("Combined");
  await expect(page.getByTestId("attendance-result-count")).toContainText("1");

  await page.getByTestId("attendance-from-date").fill("2099-01-15");
  await page.getByTestId("attendance-to-date").fill("2099-01-15");
  await expect(cards).toHaveCount(1);
  await cards.first().getByRole("button", { name: "View attendance" }).click();

  const detail = page.getByTestId("attendance-member-detail");
  await expect(detail.getByRole("heading", { name: seededMember })).toBeVisible();
  await expect(detail.getByRole("button", { name: "Meetings (1)" })).toBeVisible();
  await expect(detail.getByTestId("attendance-history-list")).toContainText("15 Jan 2099");
  await expect(detail.getByTestId("attendance-history-list")).toContainText("Attended");

  await detail.getByRole("button", { name: /Events \(/ }).click();
  await expect(detail.getByRole("button", { name: /Events \(/ })).toHaveAttribute("class", /MuiButton-contained/);
  await detail.getByRole("button", { name: "Back to members" }).click();
  await expect(search).toHaveValue(seededMember);
  await expect(page.getByRole("combobox", { name: "Section" })).toContainText("Scouts");
  await expect(page.getByTestId("attendance-from-date")).toHaveValue("2099-01-15");
  await expect(page.getByTestId("attendance-to-date")).toHaveValue("2099-01-15");

  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "Section" })).toContainText("All permitted sections");
  await expect(page.getByRole("combobox", { name: "Scout period" })).toContainText("Custom / all dates");
  await expect(page.getByTestId("attendance-from-date")).toHaveValue("");
  await expect(page.getByTestId("attendance-to-date")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Reset filters" })).toHaveCount(0);
});
