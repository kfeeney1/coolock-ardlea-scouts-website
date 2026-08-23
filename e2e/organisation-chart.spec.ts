import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

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

test("public Who's Who only shows approved Scout Group roles", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "About Us" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Who’s Who" })).toBeVisible();
  await expect(page.getByText(/Meet the leaders who have chosen to be listed publicly/)).toBeVisible();
  await expect(page.getByText("Unable to load the organisation chart.")).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "Niamh Murphy", exact: true })).toBeVisible();
  await expect(page.getByText("Beaver Programme Scouter", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Aisling Ryan", exact: true })).toBeVisible();
  await expect(page.getByText("Scout Programme Scouter", { exact: true })).toBeVisible();

  // A website admin remains private even when its scouting appointment is otherwise allowed.
  await expect(page.getByRole("heading", { name: "Orla Kelly", exact: true })).toHaveCount(0);
  // Legacy/non-approved titles are rejected even when showPublicly is true in Firestore.
  await expect(page.getByRole("heading", { name: "Conor Walsh", exact: true })).toHaveCount(0);
  await expect(page.getByText("Assistant Section Leader", { exact: true })).toHaveCount(0);
});

test("organisation chart rejects unauthenticated leader access", async ({ page }) => {
  await page.goto("/leader/organisation");
  await expect(page).toHaveURL(/\/leader\/login$/);
});

test("programme scouter can open the internal organisation chart with leader data", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page, "test.leader.only@example.com");
  await page.goto("/leader/organisation");
  await expect(page.getByRole("heading", { name: "Organisational Chart" })).toBeVisible();
  await expect(page.getByText("Unable to load the organisation chart.")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Orla Kelly", exact: true })).toBeVisible();
  await expect(page.getByText("Group Leader", { exact: true })).toBeVisible();
});

test("administrator sees organisation controls in Leader Access", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page, "test.admin@example.com");
  await page.goto("/leader/access");
  await expect(page.getByRole("heading", { name: "Leader Access & Organisation" })).toBeVisible();
  await expect(page.getByText("Organisational chart").first()).toBeVisible();
  await expect(page.getByText("Show on public Who's Who").first()).toBeVisible();
});
