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

test("public Who's Who is available without signing in", async ({ page }) => {
  await page.goto("/whos-who");
  await expect(page.getByRole("heading", { name: "Who’s Who" })).toBeVisible();
  await expect(page.getByText(/Meet the leaders who have chosen to be listed publicly/)).toBeVisible();
});

test("organisation chart rejects unauthenticated leader access", async ({ page }) => {
  await page.goto("/leader/organisation");
  await expect(page).toHaveURL(/\/leader\/login$/);
});

test("section leader can open the internal organisation chart", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page, "test.leader.only@example.com");
  await page.goto("/leader/organisation");
  await expect(page.getByRole("heading", { name: "Organisational Chart" })).toBeVisible();
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
