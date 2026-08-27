import { expect, test, type TestInfo } from "@playwright/test";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Authenticated member-history search runs once on desktop Chromium.");
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

test("member history search narrows the permitted member selector", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await loginLeader(page);

  await page.getByRole("button", { name: /Leader Menu/ }).click();
  await page.getByRole("link", { name: "Member History" }).click();
  await expect(page).toHaveURL(/\/leader\/member-history$/);
  await expect(page.getByRole("heading", { name: "Member History" })).toBeVisible();

  const search = page.getByLabel("Search members");
  const matchCount = page.getByTestId("member-history-match-count");
  await expect(matchCount).toContainText("members shown");

  await search.fill("Casey OBrien Scouts 01");
  await expect(matchCount).toHaveText(/1 of \d+ members shown/);
  await expect(page.getByTestId("member-history-detail").getByRole("heading", { name: "Casey OBrien Scouts 01" })).toBeVisible();

  await search.fill("member that does not exist");
  await expect(page.getByText("No members match your search.")).toBeVisible();
  await expect(matchCount).toHaveText(/0 of \d+ members shown/);
  await expect(page.getByTestId("member-history-detail")).toHaveCount(0);
});
