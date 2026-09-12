import { expect, test, type Download, type Page, type TestInfo } from "@playwright/test";

type Credentials = { email: string; password: string };

function adminCredentials(): Credentials | null {
  const email = process.env.E2E_ADMIN_EMAIL?.trim();
  const password = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
  return email && password ? { email, password } : null;
}

async function loginLeader(page: Page, account: Credentials) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function downloadText(download: Download) {
  const stream = await download.createReadStream();
  let value = "";
  for await (const chunk of stream) value += chunk.toString();
  return value;
}

async function downloadPreparedReport(page: Page) {
  const dialog = page.getByRole("dialog", { name: "Report ready" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Open report" })).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("link", { name: "Download report" }).click();
  const download = await downloadPromise;
  await dialog.getByRole("button", { name: "Keep working" }).click();
  return download;
}

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Equipment report downloads run once on desktop Chromium.");
}

test("equipment manager sees the operational overview and can generate, open and download inventory reports", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  const account = adminCredentials();
  test.skip(!account, "Configure the seeded E2E admin account to run this check.");
  await loginLeader(page, account!);

  await page.goto("/leader/equipment");
  await expect(page.getByRole("heading", { name: "Equipment & Stores" })).toBeVisible();
  const dashboard = page.getByTestId("equipment-operations-dashboard");
  await expect(dashboard.getByRole("heading", { name: "Equipment overview" })).toBeVisible();
  await expect(dashboard.getByRole("heading", { name: "Recent activity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Detailed inventory" })).toBeVisible();

  const reports = page.getByTestId("equipment-reports-panel");
  await expect(reports.getByRole("heading", { name: "Equipment Reports" })).toBeVisible();

  await page.getByTestId("export-all-equipment-csv").click();
  const ready = page.getByRole("dialog", { name: "Report ready" });
  await expect(ready.getByRole("button", { name: "Open report" })).toBeVisible();
  const popupPromise = page.waitForEvent("popup");
  await ready.getByRole("button", { name: "Open report" }).click();
  const popup = await popupPromise;
  await expect.poll(() => popup.url()).toMatch(/^blob:/);
  await popup.close();
  const allDownload = await downloadPreparedReport(page);
  expect(allDownload.suggestedFilename()).toMatch(/^all-equipment-\d{4}-\d{2}-\d{2}\.csv$/);
  const allContent = await downloadText(allDownload);
  expect(allContent.startsWith("\uFEFF")).toBe(false);
  expect(allContent.startsWith('"Equipment","Category"')).toBe(true);
  expect(allContent).toContain('"Damage","Current checkout","Last checked in","Last used"');
  expect(allContent).toContain("TEST Patrol Tents");

  await reports.getByLabel("Report").click();
  await page.getByRole("option", { name: "Current Section Holdings" }).click();
  await page.getByTestId("export-selected-equipment-report").click();
  const selectedDownload = await downloadPreparedReport(page);
  expect(selectedDownload.suggestedFilename()).toMatch(/^current-section-holdings-\d{4}-\d{2}-\d{2}\.csv$/);

  await page.getByTestId("export-equipment-asset-register").click();
  const registerDownload = await downloadPreparedReport(page);
  expect(registerDownload.suggestedFilename()).toMatch(/^equipment-asset-register-\d{4}-\d{2}-\d{2}\.csv$/);
  const registerContent = await downloadText(registerDownload);
  expect(registerContent).toContain('"Date Purchased","Quantity","Description"');
  expect(registerContent).toContain('"8","TEST Patrol Tents"');
});

test("recorded equipment damage subsequently appears in the inventory report", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  const account = adminCredentials();
  test.skip(!account, "Configure the seeded E2E admin account to run this check.");
  const itemName = `TEST Report Damage ${testInfo.retry}`;
  const damageNote = `Bent frame regression ${testInfo.retry}`;
  await page.route("**/equipment-incident", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sent: 1 }) });
  });
  await loginLeader(page, account!);
  await page.goto("/leader/equipment");

  await page.getByRole("button", { name: "Add equipment" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add equipment" });
  await addDialog.getByLabel("Equipment name").fill(itemName);
  const addComboboxes = addDialog.getByRole("combobox");
  await addComboboxes.nth(0).click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await addComboboxes.nth(1).click();
  const existingStore = page.getByRole("option", { name: "TEST Checkout Store", exact: true });
  if (await existingStore.count()) await existingStore.click();
  else {
    await page.getByRole("option", { name: "Other…" }).click();
    await addDialog.getByLabel("New storage location").fill("TEST Checkout Store");
  }
  await addDialog.getByLabel("Total quantity").fill("2");
  await addDialog.getByRole("button", { name: "Save equipment" }).click();
  await expect(page.getByText(itemName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Check out equipment" }).click();
  const checkoutDialog = page.getByRole("dialog", { name: "Check out equipment" });
  await checkoutDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Scouts" }).click();
  const checkoutRow = checkoutDialog.getByText(itemName, { exact: true }).locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]");
  await checkoutRow.getByLabel("Qty").fill("1");
  await checkoutDialog.getByRole("button", { name: "Confirm checkout" }).click();
  await expect(page.getByText(`1 × ${itemName}`, { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Report issue" }).click();
  const incidentDialog = page.getByRole("dialog", { name: "Report equipment issue" });
  const incidentComboboxes = incidentDialog.getByRole("combobox");
  await incidentComboboxes.nth(0).click();
  await page.getByRole("option", { name: new RegExp(`Scouts checkout · ${itemName} · 1 out`) }).click();
  await incidentComboboxes.nth(1).click();
  await page.getByRole("option", { name: "Damaged" }).click();
  await incidentDialog.getByLabel("Quantity affected").fill("1");
  await incidentDialog.getByLabel("What happened?").fill(damageNote);
  await incidentDialog.getByRole("button", { name: "Report issue" }).click();
  await expect(page.getByText(damageNote, { exact: true })).toBeVisible();

  await page.getByTestId("export-all-equipment-csv").click();
  const content = await downloadText(await downloadPreparedReport(page));
  const itemRow = content.split("\r\n").find((line) => line.includes(itemName)) ?? "";
  expect(itemRow).toContain(damageNote);
  expect(itemRow).toContain("reported");
  expect(itemRow).toContain("Scouts");
});

test("ordinary leaders cannot access equipment reports", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  const email = process.env.E2E_MULTI_SECTION_LEADER_EMAIL?.trim();
  const password = process.env.E2E_TEST_USER_PASSWORD;
  test.skip(!email || !password, "Configure the seeded ordinary leader account to run this check.");
  await loginLeader(page, { email: email!, password: password! });
  await page.goto("/leader/equipment");
  await expect(page.getByRole("heading", { name: "Equipment & Stores" })).toBeVisible();
  await expect(page.getByTestId("equipment-operations-dashboard")).toHaveCount(0);
  await expect(page.getByTestId("equipment-reports-panel")).toHaveCount(0);
  await expect(page.getByTestId("export-equipment-asset-register")).toHaveCount(0);
});
