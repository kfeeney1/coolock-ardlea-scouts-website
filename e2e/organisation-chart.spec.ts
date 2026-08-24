import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Organisation role checks run once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("legacy Who's Who URL redirects to About", async ({ page }) => {
  await page.goto("/whos-who");
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { name: "About Us" })).toBeVisible();
});

test("rebuilt public Who's Who renders canonical section and Group leaders and excludes website admins", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "About Us" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who’s Who" })).toBeVisible();
  await expect(page.getByTestId("public-whos-who")).toBeVisible();
  await expect(page.getByText("Unable to load Who’s Who right now.")).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Declan O'Connor", exact: true })).toBeVisible();
  await expect(page.getByText("Group Leader", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Beavers Section Leader", exact: true })).toBeVisible();
  await expect(page.getByText("Section Leader", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Scouts Programme Scouter", exact: true })).toBeVisible();
  await expect(page.getByText("Programme Scouter", { exact: true }).first()).toBeVisible();

  for (const forbiddenName of ["Test Website Administrator", "Test Website Super Admin"]) {
    await expect(page.getByRole("heading", { name: forbiddenName, exact: true })).toHaveCount(0);
  }
  await expect(page.getByText("Group Council Administrator", { exact: true })).toHaveCount(0);
});

test("organisation chart rejects unauthenticated leader access", async ({ page }) => {
  await page.goto("/leader/organisation");
  await expect(page).toHaveURL(/\/leader\/login$/);
});

test("programme scouter can open the internal organisation chart with canonical leader data", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await login(page, leaderEmail!);
  await page.goto("/leader/organisation");
  await expect(page.getByRole("heading", { name: "Organisational Chart" })).toBeVisible();
  await expect(page.getByText("Unable to load the internal organisation chart.")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Test Website Administrator", exact: true })).toBeVisible();
  await expect(page.getByText("Group Council Administrator", { exact: true }).first()).toBeVisible();
});

test("administrator sees organisation controls in Leader Access", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page, "test.webadmin@example.com");
  await page.goto("/leader/access");
  await expect(page.getByRole("heading", { name: "Leader Access & Organisation" })).toBeVisible();
  await expect(page.getByText("Organisational chart").first()).toBeVisible();
  await expect(page.getByText("Show on public Who's Who").first()).toBeVisible();
});
