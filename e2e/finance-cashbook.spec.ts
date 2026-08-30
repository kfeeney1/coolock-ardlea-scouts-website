import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Section float checks run once on desktop Chromium.");
}

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(leaderEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("section leader sees the constrained Section Floats workflow", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page);
  await page.goto("/leader/finance");

  await expect(page.getByRole("heading", { name: "Section Floats" })).toBeVisible();
  const sectionSelect = page.getByRole("combobox", { name: "Section" });
  await expect(sectionSelect).toBeVisible();
  await expect(sectionSelect).toContainText("Scouts");
  await expect(page.getByText("Current float")).toBeVisible();

  const transactionSelect = page.getByRole("combobox", { name: "Transaction" });
  await transactionSelect.click();
  await expect(page.getByRole("option", { name: "Open float" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Float top up" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Money out" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Close float" })).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("combobox", { name: "Outgoing category" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attach receipt" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Float reconciliation" })).toBeVisible();
  await expect(page.getByLabel("Physical float counted (€)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save reconciliation" })).toBeDisabled();
});
