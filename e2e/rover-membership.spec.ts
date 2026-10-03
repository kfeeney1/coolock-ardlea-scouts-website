import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill("test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("adult leader Rover self-service persists, appears in Member Management and can be ended", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Rover membership mutation runs once on desktop Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/profile");
  const leaderDisplayName = await page.getByLabel("Display name").inputValue();

  const panel = page.getByTestId("rover-self-membership");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: /Join Rovers|End Rover Membership/ })).toBeVisible();
  const join = panel.getByRole("button", { name: "Join Rovers" });
  if (await join.isVisible().catch(() => false)) {
    await expect(panel.getByLabel("First name")).not.toHaveValue("");
    await expect(panel.getByLabel("Last name")).not.toHaveValue("");
    await join.click();
    await expect(panel.getByText("Your Rover membership is active and linked to your account.")).toBeVisible();
  }

  await page.reload();
  await expect(panel.getByRole("button", { name: "End Rover Membership" })).toBeVisible();
  await page.goto("/leader/members");
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Rovers", exact: true }).click();
  const cards = page.locator("[data-testid^='member-card-']");
  await expect(cards.filter({ hasText: leaderDisplayName })).toHaveCount(1);

  await page.goto("/leader/profile");
  const end = page.getByTestId("rover-self-membership").getByRole("button", { name: "End Rover Membership" });
  await end.click();
  await expect(page.getByText("Your Rover membership has ended.")).toBeVisible();
});

test("Rover self-service remains usable on the mobile profile layout", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile profile coverage runs once on Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/profile");
  const panel = page.getByTestId("rover-self-membership");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Explicitly join or leave Rovers.")).toBeVisible();
  await expect(panel.getByRole("button", { name: /Join Rovers|End Rover Membership/ })).toBeVisible();
});
