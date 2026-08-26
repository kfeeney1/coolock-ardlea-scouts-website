import { expect, test } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

test("leader menu prioritises Weekly Meetings and Events and moves organisation chart into Info", async ({ page }) => {
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(leaderEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

  await page.getByRole("button", { name: /Open Leader Menu|Menu ·/ }).click();
  const menu = page.locator("#leader-navigation");
  const menuButtons = menu.getByRole("link");
  await expect(menuButtons.nth(0)).toHaveText("Weekly Meetings");
  await expect(menuButtons.nth(1)).toHaveText("Events & Activities");
  await expect(menu.getByRole("link", { name: "Weekly Tracker" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Organisational Chart" })).toHaveCount(0);

  await menu.getByRole("link", { name: "Info & FAQ" }).click();
  await expect(page).toHaveURL(/\/leader\/info$/);
  await expect(page.getByRole("heading", { name: "Organisational Chart" })).toBeVisible();
  await expect(page.getByText("Internal organisational hierarchy, sections and reporting relationships for active leaders.")).toBeVisible();
});
