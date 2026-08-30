import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Finance cashbook checks run once on desktop Chromium.");
}

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(leaderEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("section leader can open the section-scoped cashbook and reconciliation workflow", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page);
  await page.goto("/leader/finance");

  await expect(page.getByRole("heading", { name: "Section Cashbook" })).toBeVisible();
  await expect(page.getByLabel("Section")).toHaveText(/Scouts/);
  await expect(page.getByText("Calculated balance")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Cash reconciliation" })).toBeVisible();
  await expect(page.getByLabel("Physical cash counted (€)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save reconciliation" })).toBeDisabled();
});
