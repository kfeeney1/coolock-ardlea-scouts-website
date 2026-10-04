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


test("SW-281 receipt status does not download bodies and corrected receipts survive reload", async ({ page }) => {
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await login(page);
  await page.goto("/leader/finance");
  await expect(page.getByRole("heading", { name: "Section Floats" })).toBeVisible();
  // Fund this isolated expense through the ordinary authorised float workflow.
  const type = page.getByRole("combobox", { name: "Transaction", exact: true });
  await type.click();
  await page.getByRole("option", { name: "Float top up", exact: true }).click();
  await page.getByLabel("Amount (€)").fill("1.00");
  await page.getByRole("button", { name: "Save transaction", exact: true }).click();
  await expect(page.getByLabel("Amount (€)")).toHaveValue("");
  await expect(page.getByRole("button", { name: "Save transaction", exact: true })).toBeEnabled();
  await type.click();
  await page.getByRole("option", { name: "Money out", exact: true }).click();
  const description = `SW-281 receipt ${crypto.randomUUID()}`;
  await page.getByLabel("Amount (€)").fill("0.01");
  await page.getByLabel("What was the money spent on?").fill(description);
  await page.getByRole("button", { name: "Save transaction", exact: true }).click();
  const row = page.locator('[data-testid^="finance-transaction-"]').filter({ has: page.getByText(description, { exact: true }) });
  await expect(row).toBeVisible();
  await expect(row.getByText("No receipt attached", { exact: true })).toBeVisible();
  const rowId = await row.getAttribute("data-testid");
  const persistedRow = page.getByTestId(rowId!);
  let downloads = 0;
  let denyDownload = true;
  await page.route(url => url.pathname.includes("/o/") && url.searchParams.get("alt") === "media", async route => {
    downloads++;
    if (denyDownload) await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: { code: 403, message: "Permission denied" } }) });
    else await route.continue();
  });
  await persistedRow.locator('input[type="file"]').setInputFiles({ name: "sw281-receipt.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await expect(persistedRow.getByText("Receipt upload complete", { exact: true })).toBeVisible();
  await expect(persistedRow.getByText("Receipt attached", { exact: true })).toBeVisible();
  await expect(persistedRow.getByRole("button", { name: "View receipt", exact: true })).toBeVisible();
  expect(downloads).toBe(0);
  await persistedRow.getByRole("button", { name: "Correct entry", exact: true }).click();
  const correction = page.getByRole("dialog", { name: "Correct float entry" });
  await correction.getByRole("button", { name: "Create correction", exact: true }).click();
  await expect(correction).toBeHidden();
  await expect(persistedRow.getByText("Corrected", { exact: true })).toBeVisible();
  await page.reload();
  await expect(persistedRow.getByText("Receipt attached", { exact: true })).toBeVisible();
  expect(downloads).toBe(0);
  await persistedRow.getByRole("button", { name: "View receipt", exact: true }).click();
  const viewer = page.getByRole("dialog", { name: "sw281-receipt.pdf" });
  await expect(viewer.getByText(/Receipt opening was denied/)).toBeVisible();
  await viewer.getByRole("button", { name: "Close", exact: true }).click();
  await expect(persistedRow.getByText("Receipt attached", { exact: true })).toBeVisible();
  denyDownload = false;
  await persistedRow.getByRole("button", { name: "View receipt", exact: true }).click();
  await expect(viewer.getByRole("link", { name: "Open receipt in new tab" })).toHaveAttribute("href", /^blob:/);
  await viewer.getByRole("button", { name: "Close", exact: true }).click();
});
