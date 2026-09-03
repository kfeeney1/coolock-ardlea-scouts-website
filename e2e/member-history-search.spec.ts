import { expect, test, type TestInfo } from "@playwright/test";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Authenticated member-management search runs once on desktop Chromium.");
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

test("member management search opens the permitted member record with integrated history", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await loginLeader(page);

  await page.getByRole("button", { name: /Leader Menu|Menu ·/ }).click();
  await page.getByRole("link", { name: "Member Management" }).click();
  await expect(page).toHaveURL(/\/leader\/members$/);
  await expect(page.getByRole("heading", { name: "Member Management" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Member History" })).toHaveCount(0);

  const search = page.getByLabel("Search members");
  await search.fill("Casey OBrien Scouts 01");

  const memberCard = page.locator('[data-testid^="member-card-"]').filter({ hasText: "Casey OBrien Scouts 01" });
  await expect(memberCard).toHaveCount(1);
  await memberCard.click({ position: { x: 20, y: 20 } });

  await expect(page).toHaveURL(/\/leader\/members\/[^/]+$/);
  await expect(page.getByRole("heading", { name: "Casey OBrien Scouts 01", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Member History" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/leader\/members$/);
  await page.getByLabel("Search members").fill("member that does not exist");
  await expect(page.getByText("No members match the current filters.")).toBeVisible();
});
