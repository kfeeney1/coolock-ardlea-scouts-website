import { expect, test, type Page, type TestInfo } from "@playwright/test";

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

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Equipment checkout runs once on desktop Chromium.");
}

test("admin can add stock, check it out to a section and return it", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  const account = adminCredentials();
  test.skip(!account, "Configure the seeded E2E admin account to run this check.");
  await loginLeader(page, account!);

  await page.goto("/leader/equipment");
  await expect(page.getByRole("heading", { name: "Equipment & Stores" })).toBeVisible();

  await page.getByRole("button", { name: "Add equipment" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add equipment" });
  await expect(addDialog).toBeVisible();
  await addDialog.getByLabel("Equipment name").fill("TEST Checkout Tent");
  const addComboboxes = addDialog.getByRole("combobox");
  await addComboboxes.nth(0).click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await addComboboxes.nth(1).click();
  await page.getByRole("option", { name: "Other…" }).click();
  await addDialog.getByLabel("New storage location").fill("TEST Checkout Store");
  await addDialog.getByLabel("Total quantity").fill("3");
  await addDialog.getByRole("button", { name: "Save equipment" }).click();
  await expect(page.getByText("TEST Checkout Tent", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Check out equipment" }).click();
  const checkoutDialog = page.getByRole("dialog", { name: "Check out equipment" });
  await expect(checkoutDialog).toBeVisible();
  await checkoutDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Scouts" }).click();
  const checkoutRow = checkoutDialog.getByText("TEST Checkout Tent", { exact: true }).locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]");
  await checkoutRow.getByLabel("Qty").fill("2");
  await checkoutDialog.getByRole("button", { name: "Confirm checkout" }).click();

  await expect(page.getByText("2 × TEST Checkout Tent", { exact: false })).toBeVisible();
  const inventoryCard = page.getByText("TEST Checkout Tent", { exact: true }).last().locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]");
  await expect(inventoryCard.getByText("1 available", { exact: true })).toBeVisible();
  await expect(inventoryCard.getByText("2 checked out", { exact: true })).toBeVisible();

  const holdingCard = page.getByText("2 × TEST Checkout Tent", { exact: false }).locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]");
  await holdingCard.getByRole("button", { name: "Return equipment" }).click();
  const returnDialog = page.getByRole("dialog", { name: /Return equipment/ });
  await expect(returnDialog.getByText("2 currently checked out")).toBeVisible();
  await returnDialog.getByRole("button", { name: "Confirm return" }).click();

  await expect(page.getByText("No equipment is currently checked out.")).toBeVisible();
  const returnedCard = page.getByText("TEST Checkout Tent", { exact: true }).last().locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]");
  await expect(returnedCard.getByText("3 available", { exact: true })).toBeVisible();
});

test("missing checkout equipment can be investigated and resolved back into stock", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  const account = adminCredentials();
  test.skip(!account, "Configure the seeded E2E admin account to run this check.");
  const incidentName = `TEST Incident Tent ${testInfo.retry}`;
  let notificationCalls = 0;
  await page.route("**/equipment-incident", async (route) => {
    notificationCalls += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sent: 2 }) });
  });
  await loginLeader(page, account!);
  await page.goto("/leader/equipment");

  await page.getByRole("button", { name: "Add equipment" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add equipment" });
  await addDialog.getByLabel("Equipment name").fill(incidentName);
  const addComboboxes = addDialog.getByRole("combobox");
  await addComboboxes.nth(0).click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await addComboboxes.nth(1).click();
  await page.getByRole("option", { name: "TEST Checkout Store" }).click();
  await addDialog.getByLabel("Total quantity").fill("3");
  await addDialog.getByRole("button", { name: "Save equipment" }).click();
  await expect(page.getByText(incidentName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Check out equipment" }).click();
  const checkoutDialog = page.getByRole("dialog", { name: "Check out equipment" });
  await checkoutDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Scouts" }).click();
  const checkoutRow = checkoutDialog.getByText(incidentName, { exact: true }).locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]");
  await checkoutRow.getByLabel("Qty").fill("2");
  await checkoutDialog.getByRole("button", { name: "Confirm checkout" }).click();

  await page.getByRole("button", { name: "Report issue" }).click();
  const incidentDialog = page.getByRole("dialog", { name: "Report equipment issue" });
  const incidentComboboxes = incidentDialog.getByRole("combobox");
  await incidentComboboxes.nth(0).click();
  await page.getByRole("option", { name: new RegExp(`Scouts checkout · ${incidentName} · 2 out`) }).click();
  await incidentComboboxes.nth(1).click();
  await page.getByRole("option", { name: "Missing" }).click();
  await incidentDialog.getByLabel("Quantity affected").fill("1");
  await incidentDialog.getByLabel("What happened?").fill("One tent was not returned with the rest of the section equipment.");
  await incidentDialog.getByRole("button", { name: "Report issue" }).click();

  const incidentCard = page.getByText(`1 × ${incidentName}`, { exact: false }).first().locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]");
  await expect(incidentCard).toBeVisible();
  const inventoryCard = page.getByText(incidentName, { exact: true }).last().locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]");
  await expect(inventoryCard.getByText("1 available", { exact: true })).toBeVisible();
  await expect(inventoryCard.getByText("1 checked out", { exact: true })).toBeVisible();
  await expect(inventoryCard.getByText("1 unavailable", { exact: true })).toBeVisible();
  await expect.poll(() => notificationCalls).toBe(1);

  await incidentCard.getByRole("button", { name: "Start investigation" }).click();
  await expect(incidentCard.getByText("Investigating", { exact: true })).toBeVisible();
  await incidentCard.getByRole("button", { name: "Resolve" }).click();
  const resolveDialog = page.getByRole("dialog", { name: "Resolve equipment issue" });
  await expect(resolveDialog).toBeVisible();
  await resolveDialog.getByLabel("Resolution notes").fill("Found in the trailer after the return was checked.");
  await resolveDialog.getByRole("button", { name: "Confirm resolution" }).click();

  const resolvedInventoryCard = page.getByText(incidentName, { exact: true }).last().locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]");
  await expect(resolvedInventoryCard.getByText("2 available", { exact: true })).toBeVisible();
  await expect(resolvedInventoryCard.getByText("1 checked out", { exact: true })).toBeVisible();
  await expect(resolvedInventoryCard.getByText("1 unavailable", { exact: true })).toHaveCount(0);
});

test("admin can partially move stock and see the movement in item history", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  desktopOnly(testInfo);
  const account = adminCredentials();
  test.skip(!account, "Configure the seeded E2E admin account to run this check.");
  const destination = `TEST Move Store ${testInfo.retry}`;
  const markerName = `TEST Move Marker ${testInfo.retry}`;
  const itemName = `TEST Move Tents ${testInfo.retry}`;
  await loginLeader(page, account!);
  await page.goto("/leader/equipment");

  await page.getByRole("button", { name: "Add equipment" }).click();
  let addDialog = page.getByRole("dialog", { name: "Add equipment" });
  await addDialog.getByLabel("Equipment name").fill(markerName);
  let comboboxes = addDialog.getByRole("combobox");
  await comboboxes.nth(0).click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await comboboxes.nth(1).click();
  await page.getByRole("option", { name: "Other…" }).click();
  await addDialog.getByLabel("New storage location").fill(destination);
  await addDialog.getByLabel("Total quantity").fill("1");
  await addDialog.getByRole("button", { name: "Save equipment" }).click();
  await expect(page.getByText(markerName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add equipment" }).click();
  addDialog = page.getByRole("dialog", { name: "Add equipment" });
  await addDialog.getByLabel("Equipment name").fill(itemName);
  comboboxes = addDialog.getByRole("combobox");
  await comboboxes.nth(0).click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await comboboxes.nth(1).click();
  await page.getByRole("option", { name: "TEST Checkout Store" }).click();
  await addDialog.getByLabel("Total quantity").fill("4");
  await addDialog.getByRole("button", { name: "Save equipment" }).click();
  await expect(page.getByText(itemName, { exact: true })).toBeVisible();

  const sourceCard = page.getByText(itemName, { exact: true }).locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]").filter({ hasText: "TEST Checkout Store" });
  await sourceCard.getByRole("button", { name: "History / move" }).click();
  const historyDialog = page.getByRole("dialog", { name: `${itemName} history` });
  await expect(historyDialog).toBeVisible();
  await historyDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: destination }).click();
  await historyDialog.getByLabel("Quantity to move").fill("2");
  await historyDialog.getByRole("button", { name: "Move stock" }).click();
  await expect(historyDialog.getByText("Stock moved out", { exact: true })).toBeVisible();
  await expect(historyDialog.getByText(`TEST Checkout Store → ${destination}`, { exact: true })).toBeVisible();
  await historyDialog.getByRole("button", { name: "Close" }).click();

  const sourceAfter = page.getByText(itemName, { exact: true }).locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]").filter({ hasText: "TEST Checkout Store" });
  const destinationAfter = page.getByText(itemName, { exact: true }).locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')][1]").filter({ hasText: destination });
  await expect(sourceAfter.getByText("2 total", { exact: true })).toBeVisible();
  await expect(destinationAfter.getByText("2 total", { exact: true })).toBeVisible();
});
