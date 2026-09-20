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

  const newFloat = page.getByRole("button", { name: "New Float" });
  await expect(newFloat).toBeVisible();
  await newFloat.click();
  const dialog = page.getByRole("dialog", { name: "New section float" });
  await expect(dialog).toBeVisible();
  const newFloatSection = dialog.getByRole("combobox", { name: "Section" });
  await expect(newFloatSection).toContainText("Scouts");
  const openingAmount = dialog.getByLabel("Opening amount (€)");
  await openingAmount.fill("12.345");
  await expect(openingAmount).toHaveValue("");
  await openingAmount.fill("25.00");
  await expect(dialog.getByRole("button", { name: "Create float" })).toBeEnabled();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  const transactionSelect = page.getByRole("combobox", { name: "Transaction" });
  await transactionSelect.click();
  await expect(page.getByRole("option", { name: "Open float" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Float top up" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Money out" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Close float" })).toBeVisible();
  await page.keyboard.press("Escape");

  const amount = page.getByLabel("Amount (€)");
  await amount.fill("12.345");
  await expect(amount).toHaveValue("");
  await amount.fill("12.34");
  await expect(amount).toHaveValue("12.34");
  await expect(page.getByText("Maximum two decimal places.")).toBeVisible();

  await expect(page.getByRole("combobox", { name: "Outgoing category" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Attach receipt" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Float reconciliation" })).toBeVisible();
  await expect(page.getByLabel("Physical float counted (€)")).toBeVisible();
  await expect(page.getByRole("button", { name: "Save reconciliation" })).toBeDisabled();
});
