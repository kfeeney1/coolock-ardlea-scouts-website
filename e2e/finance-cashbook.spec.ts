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

test("SW-215 float transaction and correction dates render DD-MM-YYYY on desktop and mobile", async ({ page }) => {
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await login(page);
  await page.goto("/leader/finance");
  await expect(page.getByRole("heading", { name: "Section Floats" })).toBeVisible();

  const type = page.getByRole("combobox", { name: "Transaction", exact: true });
  await type.click();
  await expect(page.getByText("Loading section float…", { exact: true })).toBeHidden();
  const emptyFloat = await page.getByText("No float transactions have been recorded for this section.", { exact: true }).isVisible();
  if (emptyFloat) {
    await page.getByRole("option", { name: "Open float", exact: true }).click();
    await page.getByLabel("Date", { exact: true }).fill("2026-09-29");
    await page.getByLabel("Amount (€)").fill("10.00");
    await page.getByRole("button", { name: "Save transaction", exact: true }).click();
    const opening = page.locator('[data-testid^="finance-transaction-"]').filter({ has: page.getByText("Open float", { exact: true }) });
    await expect(opening).toContainText("29-09-2026");
    await expect(opening).not.toContainText("2026-09-29");
    await type.click();
  }
  await page.getByRole("option", { name: "Money out", exact: true }).click();

  const description = `SW-215 date audit ${crypto.randomUUID()}`;
  await page.getByLabel("Date", { exact: true }).fill("2026-10-03");
  await page.getByLabel("Amount (€)").fill("0.01");
  await page.getByLabel("What was the money spent on?").fill(description);
  await page.getByRole("button", { name: "Save transaction", exact: true }).click();
  const row = page.locator('[data-testid^="finance-transaction-"]').filter({ has: page.getByText(description, { exact: true }) });
  await expect(row).toBeVisible();
  await expect(row).toContainText("03-10-2026");
  await expect(row).not.toContainText("2026-10-03");
  await expect(row.getByText(/^Entered \d{2}-\d{2}-\d{4}, \d{2}:\d{2}$/)).toBeVisible();
  await expect(row).not.toContainText(/Entered \d{4}-\d{2}-\d{2}/);

  await row.getByRole("button", { name: "Correct entry", exact: true }).click();
  const correction = page.getByRole("dialog", { name: "Correct float entry" });
  await correction.getByLabel("Correction date").fill("2026-10-03");
  await correction.getByRole("button", { name: "Create correction", exact: true }).click();
  const correctionRow = page.locator('[data-testid^="finance-transaction-"]').filter({ hasText: `Correction of ${description}` });
  await expect(correctionRow).toContainText("03-10-2026");
  await expect(correctionRow).not.toContainText("2026-10-03");
});


test("SW-281 receipt status does not download bodies and corrected receipts survive reload", async ({ page }) => {
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await login(page);
  await page.goto("/leader/finance");
  await expect(page.getByRole("heading", { name: "Section Floats" })).toBeVisible();
  // Fund this isolated expense through the ordinary authorised float workflow.
  const type = page.getByRole("combobox", { name: "Transaction", exact: true });
  await type.click();
  await expect(page.getByText("Loading section float…", { exact: true })).toBeHidden();
  const emptyFloat = await page.getByText("No float transactions have been recorded for this section.", { exact: true }).isVisible();
  await page.getByRole("option", { name: emptyFloat ? "Open float" : "Float top up", exact: true }).click();
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
  await expect(viewer.getByRole("alert")).toContainText("Service: Firebase Storage");
  await expect(viewer.getByRole("alert")).toContainText("Code: UNAUTHORIZED");
  await expect(viewer.getByRole("alert")).toContainText("Operation: Receipt open");
  await expect(viewer.getByRole("alert")).toContainText(/Reference: ERR-[A-F0-9]{12}/);
  await expect(viewer.getByRole("alert")).toContainText("Action:");
  await expect(viewer.getByRole("alert")).not.toContainText(/Retry.*Try again|contact an administrator.*contact an administrator/i);
  await viewer.getByRole("button", { name: "Close", exact: true }).click();
  await expect(persistedRow.getByText("Receipt attached", { exact: true })).toBeVisible();
  denyDownload = false;
  await persistedRow.getByRole("button", { name: "View receipt", exact: true }).click();
  await expect(viewer.getByRole("link", { name: "Open receipt in new tab" })).toHaveAttribute("href", /^blob:/);
  await viewer.getByRole("button", { name: "Close", exact: true }).click();
  // SW-286: a rejected second upload must preserve the existing receipt and
  // cannot retain the earlier successful-upload status.
  await page.route(url => url.port === "9199" && url.searchParams.has("name"), async route => {
    if (route.request().method() === "POST") await route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ error: { code: 403, message: "PRIVATE_RECEIPT_PAYLOAD" } }) });
    else await route.continue();
  });
  await persistedRow.locator('input[type="file"]').setInputFiles({ name: "sw286-denied.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await expect(persistedRow.getByRole("alert")).toContainText(/Receipt upload was denied/);
  await expect(persistedRow.getByRole("alert")).toContainText(/Reference: ERR-[A-F0-9]{12}/);
  await expect(persistedRow.getByRole("alert")).toContainText("Code: UNAUTHORIZED");
  await expect(persistedRow.getByRole("alert")).not.toContainText("PRIVATE_RECEIPT_PAYLOAD");
  await expect(persistedRow.getByText("Receipt upload complete", { exact: true })).toHaveCount(0);
  await expect(persistedRow.getByRole("button", { name: "Retry upload", exact: true })).toBeVisible();
  await expect(persistedRow.getByText("Receipt attached", { exact: true })).toBeVisible();
});
