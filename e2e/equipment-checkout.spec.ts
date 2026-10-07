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
  const leaderNavigation = page.waitForURL((url) => url.pathname === "/leader");
  await page.getByRole("button", { name: "Sign In" }).click();
  await leaderNavigation;
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Equipment checkout runs once on desktop Chromium.");
}

test("admin can add, check out and check in stock from its record and verify persisted history", async ({ page }, testInfo) => {
  const account = adminCredentials();
  const itemName = `TEST Checkout Tent ${testInfo.project.name} ${Date.now()}`;
  const storeName = "TEST Checkout Store";
  await loginLeader(page, account!);

  await page.goto("/leader/equipment");
  await expect(page.getByRole("heading", { name: "Equipment & Stores" })).toBeVisible();

  await page.getByRole("button", { name: "Add equipment" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add equipment" });
  await expect(addDialog).toBeVisible();
  await addDialog.getByLabel("Equipment name").fill(itemName);
  await addDialog.getByLabel("Category").click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await addDialog.getByLabel("Store").click();
  const existingStore = page.getByRole("option", { name: storeName, exact: true });
  if (await existingStore.count()) {
    await existingStore.click();
  } else {
    await page.getByRole("option", { name: "Other…" }).click();
    await addDialog.getByLabel("New Store").fill(storeName);
  }
  await addDialog.getByLabel("Total quantity").fill("3");
  await addDialog.getByRole("button", { name: "Save equipment" }).click();
  await expect(page.getByText(itemName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Check out equipment" }).click();
  const checkoutDialog = page.getByRole("dialog", { name: "Check out equipment" });
  await expect(checkoutDialog).toBeVisible();
  await checkoutDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Scouts" }).click();
  await checkoutDialog.getByRole("spinbutton", { name: `Qty for ${itemName}` }).fill("2");
  await checkoutDialog.getByRole("button", { name: "Confirm checkout" }).click();
  await expect(checkoutDialog).toBeHidden();

  await expect(page.getByText(`2 × ${itemName}`, { exact: false })).toBeVisible();
  const inventoryCard = page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: itemName });
  await expect(inventoryCard.getByText("1 available", { exact: true })).toBeVisible();
  await expect(inventoryCard.getByText("2 checked out", { exact: true })).toBeVisible();

  const itemTestId = await inventoryCard.getAttribute("data-testid");
  const itemId = itemTestId?.replace("equipment-inventory-card-", "");
  expect(itemId).toBeTruthy();
  await inventoryCard.getByText(itemName, { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/leader/equipment/${itemId}$`));
  const record = page.getByTestId("equipment-record-summary");
  await expect(page.getByRole("heading", { name: itemName, exact: true })).toBeVisible();
  await expect(record).toContainText("2 checked out");
  await record.getByRole("button", { name: "Check in / Return", exact: true }).click();
  const returnDialog = page.getByRole("dialog", { name: `Check in / Return ${itemName}` });
  await expect(returnDialog.getByText("2 currently checked out")).toBeVisible();
  await returnDialog.getByRole("button", { name: "Confirm check in" }).click();
  await expect(returnDialog).toBeHidden();
  await expect(record).toContainText("0 checked out");
  await page.reload();
  await expect(page.getByTestId("equipment-record-summary")).toContainText("0 checked out");
  await page.getByRole("button", { name: "History", exact: true }).click();
  const history = page.getByRole("dialog", { name: `${itemName} history` });
  await expect(history.getByText("Checked out", { exact: true })).toBeVisible();
  await expect(history.getByText("Returned", { exact: true })).toBeVisible();
  await history.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();

  const returnedCard = page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: itemName });
  await expect(returnedCard.getByText("3 available", { exact: true })).toBeVisible();

  const search = page.getByLabel("Search equipment");
  const category = page.locator("#equipment-category-filter");
  const location = page.locator("#equipment-location-filter");
  await search.fill(itemName);
  await expect.poll(() => new URL(page.url()).searchParams.get("q")).toBe(itemName);
  await category.click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("category")).toBe("Camping & Sleeping");
  await location.click();
  await page.getByRole("option", { name: storeName }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("store")).toBe(storeName);
  await page.getByRole("button", { name: "Show archived" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("archived")).toBe("1");
  await expect(page.getByTestId("equipment-result-count")).toContainText("1 matching equipment item");
  await expect(page.getByRole("button", { name: "Reset filters" })).toBeVisible();
  await expect.poll(() => new URL(page.url()).searchParams.get("store")).toBe(storeName);

  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(search).toHaveValue("");
  await expect(category).toContainText("All categories");
  await expect(location).toContainText("All Stores");
  await expect(page.getByRole("button", { name: "Show archived" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByRole("button", { name: "Reset filters" })).toHaveCount(0);
  await expect(page).not.toHaveURL(/store=/);
});

test("missing checkout equipment can be investigated and resolved back into stock", async ({ page }, testInfo) => {
  const account = adminCredentials();
  const incidentName = `TEST Incident Tent ${testInfo.project.name} ${Date.now()}`;
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
  await addDialog.getByLabel("Category").click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await addDialog.getByLabel("Store").click();
  await page.getByRole("option", { name: "TEST Checkout Store" }).click();
  await addDialog.getByLabel("Total quantity").fill("3");
  await addDialog.getByRole("button", { name: "Save equipment" }).click();
  await expect(page.getByText(incidentName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Check out equipment" }).click();
  const checkoutDialog = page.getByRole("dialog", { name: "Check out equipment" });
  await checkoutDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Scouts" }).click();
  const checkoutRow = checkoutDialog.locator('[data-testid^="equipment-checkout-item-"]').filter({ hasText: incidentName });
  await checkoutDialog.getByRole("spinbutton", { name: `Qty for ${incidentName}` }).fill("2");
  await checkoutDialog.getByRole("button", { name: "Confirm checkout" }).click();
  await expect(checkoutDialog).toBeHidden();
  const createdLoan = page.locator('[data-testid^="equipment-loan-"]').filter({ hasText: incidentName });
  await expect(createdLoan).toBeVisible();
  await expect(createdLoan).toContainText("2 ×");

  await page.getByRole("button", { name: "Report issue" }).click();
  const incidentDialog = page.getByRole("dialog", { name: "Report equipment issue" });
  await incidentDialog.getByLabel("Equipment / checkout").click();
  await page.getByRole("option", { name: new RegExp(`Scouts checkout · ${incidentName} · 2 out`) }).click();
  await incidentDialog.getByLabel("Issue type").click();
  await page.getByRole("option", { name: "Missing" }).click();
  await incidentDialog.getByLabel("Quantity affected").fill("1");
  await incidentDialog.getByLabel("What happened?").fill("One tent was not returned with the rest of the section equipment.");
  await incidentDialog.getByRole("button", { name: "Report issue" }).click();
  const submitError = page.getByRole("alert").filter({ hasText: /equipment|issue|checkout|permission|record/i });
  await expect(incidentDialog).toBeHidden({ timeout: 15000 });

  const incidentCard = page.locator('[data-testid^="equipment-incident-"]').filter({ hasText: incidentName });
  await expect(incidentCard).toBeVisible();
  const inventoryCard = page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: incidentName });
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

  const resolvedInventoryCard = page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: incidentName });
  await expect(resolvedInventoryCard.getByText("2 available", { exact: true })).toBeVisible();
  await expect(resolvedInventoryCard.getByText("1 checked out", { exact: true })).toBeVisible();
  await expect(resolvedInventoryCard.getByText("1 unavailable", { exact: true })).toHaveCount(0);
});

test("History stays on the audit record and Move Store uses its own item-specific route", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const account = adminCredentials();
  const runId = `${testInfo.project.name} ${Date.now()}`;
  const destination = `TEST Move Store ${runId}`;
  const markerName = `TEST Move Marker ${runId}`;
  const itemName = `TEST Move Tents ${runId}`;
  await loginLeader(page, account!);
  await page.goto("/leader/equipment");

  await page.getByRole("button", { name: "Add equipment" }).click();
  let addDialog = page.getByRole("dialog", { name: "Add equipment" });
  await addDialog.getByLabel("Equipment name").fill(markerName);
  await addDialog.getByLabel("Category").click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await addDialog.getByLabel("Store").click();
  await page.getByRole("option", { name: "Other…" }).click();
  await addDialog.getByLabel("New Store").fill(destination);
  await addDialog.getByLabel("Total quantity").fill("1");
  await addDialog.getByRole("button", { name: "Save equipment" }).click();
  await expect(page.getByText(markerName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Add equipment" }).click();
  addDialog = page.getByRole("dialog", { name: "Add equipment" });
  await addDialog.getByLabel("Equipment name").fill(itemName);
  await addDialog.getByLabel("Category").click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await addDialog.getByLabel("Store").click();
  await page.getByRole("option", { name: "TEST Checkout Store" }).click();
  await addDialog.getByLabel("Total quantity").fill("4");
  await addDialog.getByRole("button", { name: "Save equipment" }).click();
  await expect(page.getByText(itemName, { exact: true })).toBeVisible();

  const sourceCard = page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: itemName }).filter({ hasText: "TEST Checkout Store" });
  const sourceTestId = await sourceCard.getAttribute("data-testid");
  const sourceId = sourceTestId?.replace("equipment-inventory-card-", "");
  expect(sourceId).toBeTruthy();
  await sourceCard.getByRole("button", { name: "History", exact: true }).click();
  const historyDialog = page.getByRole("dialog", { name: `${itemName} history` });
  await expect(historyDialog).toBeVisible();
  await expect(historyDialog.getByText("Move stock", { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL("/leader/equipment");
  await historyDialog.getByRole("button", { name: "Close" }).click();

  await sourceCard.getByRole("button", { name: "Move Store", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/leader/equipment/${sourceId}/move-store$`));
  const moveTarget = page.getByTestId("equipment-store-move-target");
  await expect(moveTarget).toHaveAttribute("data-equipment-id", sourceId!);
  await expect(moveTarget).toContainText(itemName);
  await page.getByRole("button", { name: "Back to equipment record" }).click();
  await expect(page).toHaveURL(new RegExp(`/leader/equipment/${sourceId}$`));
  await expect(page.getByTestId("equipment-record-summary")).toContainText("Store: TEST Checkout Store");
  await page.getByRole("button", { name: "Move Store", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/leader/equipment/${sourceId}/move-store$`));
  const cancelledMove = page.getByTestId("equipment-store-move-target");
  await cancelledMove.getByRole("combobox", { name: "Destination store" }).click();
  await page.getByRole("option", { name: destination, exact: true }).click();
  await cancelledMove.getByRole("spinbutton", { name: "Quantity to move" }).fill("2");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/leader/equipment/${sourceId}$`));
  await expect(page.getByTestId("equipment-record-summary")).toContainText("Store: TEST Checkout Store");
  await page.getByRole("button", { name: "Move Store", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/leader/equipment/${sourceId}/move-store$`));
  const movePage = page.getByTestId("equipment-store-move-target");
  await movePage.getByRole("combobox", { name: "Destination store" }).click();
  await page.getByRole("option", { name: destination, exact: true }).click();
  await movePage.getByRole("spinbutton", { name: "Quantity to move" }).fill("2");
  await page.getByRole("button", { name: "Move Store", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/leader/equipment/${sourceId}$`));
  await expect(page.getByTestId("equipment-store-move-success")).toContainText(`Moved 2 × ${itemName} to ${destination}`);
  await page.getByRole("button", { name: "History", exact: true }).click();
  await expect(page.getByRole("dialog", { name: `${itemName} history` }).getByText("Stock moved out", { exact: true })).toBeVisible();
  await page.getByRole("dialog", { name: `${itemName} history` }).getByRole("button", { name: "Close" }).click();
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`/leader/equipment/${sourceId}$`));
  await expect(page.getByTestId("equipment-record-summary")).toContainText("Store: TEST Checkout Store");
  await expect(page.getByTestId("equipment-record-summary")).toContainText("2 total");
  await page.goto("/leader/equipment");

  const sourceAfter = page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: itemName }).filter({ hasText: "TEST Checkout Store" });
  const destinationAfter = page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: itemName }).filter({ hasText: destination });
  await expect(sourceAfter.getByText("2 total", { exact: true })).toBeVisible();
  await expect(destinationAfter.getByText("2 total", { exact: true })).toBeVisible();
});

test("equipment quantity can be cleared from zero, replaced and persisted", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  const account = adminCredentials();
  test.skip(!account, "Configure the seeded E2E admin account to run this check.");
  const itemName = `TEST Zero Quantity ${testInfo.retry}`;
  await loginLeader(page, account!);
  await page.goto("/leader/equipment");

  await page.getByRole("button", { name: "Add equipment" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add equipment" });
  await addDialog.getByLabel("Equipment name").fill(itemName);
  await addDialog.getByLabel("Category").click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await addDialog.getByLabel("Store").click();
  await page.getByRole("option", { name: "TEST Checkout Store" }).click();
  const quantity = addDialog.getByTestId("equipment-total-quantity");
  await quantity.fill("0");
  await addDialog.getByRole("button", { name: "Save equipment" }).click();

  const card = page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: itemName });
  await expect(card.getByText("0 total", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/leader\/equipment\/[^/]+$/);
  const summary = page.getByTestId("equipment-record-summary");
  await summary.getByRole("button", { name: "Edit", exact: true }).click();
  const editQuantity = page.getByLabel("Total quantity");
  await expect(editQuantity).toHaveValue("0");
  await editQuantity.fill("");
  await expect(editQuantity).toHaveValue("");
  await editQuantity.fill("5");
  await expect(editQuantity).toHaveValue("5");
  await page.getByRole("button", { name: "Save equipment" }).click();
  await expect(page.getByText("Equipment record saved.", { exact: true })).toBeVisible();
  await expect(page.getByText("5 total", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/equipment$/);
  await expect(page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: itemName }).getByText("5 total", { exact: true })).toBeVisible();
  await page.goto("/leader");
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await page.goto("/leader/equipment");
  await expect(page.getByRole("heading", { name: "Equipment & Stores" })).toBeVisible();
  const reloadedCard = page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: itemName });
  await expect(reloadedCard.getByText("5 total", { exact: true })).toBeVisible();
});

test("dashboard tile filters inventory through the URL and browser Back restores the prior view", async ({ page }, testInfo) => {
  const account = adminCredentials();
  test.skip(!account, "Configure the seeded E2E admin account to run this check.");
  await loginLeader(page, account!);
  await page.goto("/leader/equipment");
  await expect(page.getByRole("heading", { name: "Equipment & Stores" })).toBeVisible();

  await page.getByRole("button", { name: "Show available in detailed inventory" }).click();
  await expect(page).toHaveURL(/status=available/);
  await expect(page.locator("#equipment-status-filter")).toContainText("Available stock");
  await expect(page.getByRole("button", { name: "Reset filters" })).toBeVisible();

  await page.goBack();
  await expect(page).not.toHaveURL(/status=/);
  await expect(page.locator("#equipment-status-filter")).toContainText("All statuses");
  await expect(page.getByRole("button", { name: "Reset filters" })).toHaveCount(0);

  if (testInfo.project.name === "mobile-chromium") {
    await expect(page.getByTestId("equipment-inventory-controls")).toBeVisible();
    await expect(page.getByLabel("Search equipment")).toBeVisible();
  }
});


test("equipment store filters retain their viewport when applied, changed and cleared", async ({ page }) => {
  const account = adminCredentials();
  test.skip(!account, "Configure canonical E2E admin credentials.");
  await loginLeader(page, account!);
  await page.goto("/leader/equipment");

  const storeFilter = page.getByTestId("equipment-location-filter");
  await storeFilter.scrollIntoViewIfNeeded();
  const initialScroll = await page.evaluate(() => window.scrollY);
  expect(initialScroll).toBeGreaterThan(0);

  const assertStoreFilterVisible = async () => {
    const box = await storeFilter.boundingBox();
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeLessThan(viewportHeight);
    expect(box!.y + box!.height).toBeGreaterThan(0);
  };

  const selectStore = async (name: string) => {
    await storeFilter.click();
    await page.getByRole("option", { name, exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get("store")).toBe(name);
    await assertStoreFilterVisible();
  };

  await storeFilter.click();
  const storeNames = (await page.getByRole("option").allTextContents())
    .map((name) => name.trim())
    .filter((name) => name && name !== "All Stores" && name !== "No Store assigned");
  expect(storeNames.length).toBeGreaterThanOrEqual(2);
  await page.getByRole("option", { name: storeNames[0], exact: true }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("store")).toBe(storeNames[0]);
  await assertStoreFilterVisible();

  await selectStore(storeNames[1]);
  await selectStore("All Stores");
  await expect.poll(() => new URL(page.url()).searchParams.has("store")).toBe(false);
  await assertStoreFilterVisible();
});
