import { expect, test, type Page } from "@playwright/test";

type Credentials = { email: string; password: string };

function adminCredentials(): Credentials {
  const email = process.env.E2E_ADMIN_EMAIL?.trim() || "test.webadmin@example.com";
  const password = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_TEST_USER_PASSWORD || "";
  return { email, password };
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

test("event notification response link opens its specific active event consent workflow", async ({ page }) => {
  await page.goto("/event-consent/TESTFLOWBEAVERSOPEN2026");
  await expect(page).toHaveURL(/\/event-consent\/TESTFLOWBEAVERSOPEN2026$/);
  await expect(page.getByRole("heading", { name: "Event Consent", exact: true })).toBeVisible();
  await expect(page.getByText("TEST Beavers Open Day Trip", { exact: true })).toBeVisible();
  await expect(page.getByText("Section: Beavers", { exact: true })).toBeVisible();
});

test("broken equipment email target opens the exact issue after login and protects section scope", async ({ page, browser }, testInfo) => {
  const account = adminCredentials();
  const itemName = `TEST Email Link Tent ${testInfo.project.name} ${Date.now()}`;
  let notificationCalls = 0;
  await page.route("**/equipment-incident", async (route) => {
    notificationCalls += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, sent: 2 }) });
  });
  await loginLeader(page, account);
  await page.goto("/leader/equipment");

  await page.getByRole("button", { name: "Add equipment" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add equipment" });
  await addDialog.getByLabel("Equipment name").fill(itemName);
  await addDialog.getByLabel("Category").click();
  await page.getByRole("option", { name: "Camping & Sleeping" }).click();
  await addDialog.getByLabel("Store").click();
  const existingStore = page.getByRole("option", { name: "TEST Checkout Store", exact: true });
  if (await existingStore.count()) {
    await existingStore.click();
  } else {
    await page.getByRole("option", { name: "Other…" }).click();
    await addDialog.getByLabel("New Store").fill("TEST Checkout Store");
  }
  await addDialog.getByLabel("Total quantity").fill("3");
  await addDialog.getByRole("button", { name: "Save equipment" }).click();
  const inventoryCard = page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: itemName });
  await expect(inventoryCard.getByText(itemName, { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Check out equipment" }).click();
  const checkoutDialog = page.getByRole("dialog", { name: "Check out equipment" });
  await checkoutDialog.getByRole("combobox").click();
  await page.getByRole("option", { name: "Scouts" }).click();
  await checkoutDialog.getByRole("spinbutton", { name: `Qty for ${itemName}` }).fill("2");
  await checkoutDialog.getByRole("button", { name: "Confirm checkout" }).click();
  await expect(checkoutDialog).toBeHidden();

  await expect(page).toHaveURL(/\/leader\/equipment$/);
  const checkedOutLoan = page.locator('[data-testid^="equipment-loan-"]').filter({ hasText: itemName });
  await expect(checkedOutLoan).toContainText(`2 × ${itemName}`);
  const reportIssueButton = page.getByRole("button", { name: "Report issue", exact: true });
  await expect(reportIssueButton).toBeEnabled();
  await reportIssueButton.click();
  const issueDialog = page.getByRole("dialog", { name: "Report equipment issue" });
  await issueDialog.getByLabel("Equipment / checkout").click();
  await page.getByRole("option", { name: new RegExp(`Scouts checkout · ${itemName} · 2 out`) }).click();
  await issueDialog.getByLabel("Issue type").click();
  await page.getByRole("option", { name: "Broken / damaged" }).click();
  await issueDialog.getByLabel("Quantity affected").fill("1");
  const description = "The tent zip is damaged and no longer closes securely.";
  await issueDialog.getByLabel("What happened?").fill(description);
  await issueDialog.getByRole("button", { name: "Report issue" }).click();
  await expect(issueDialog).toBeHidden({ timeout: 15000 });

  await page.getByRole("button", { name: "View reported issues" }).click();
  await expect(page).toHaveURL("/leader/equipment/issues");
  const incidentCard = page.locator('[data-testid^="equipment-incident-"]').filter({ hasText: itemName });
  await expect(incidentCard).toContainText("Broken / damaged");
  const incidentId = (await incidentCard.getAttribute("data-testid"))?.replace("equipment-incident-", "");
  await page.getByRole("button", { name: "Back to Equipment & Stores" }).click();
  await expect(page).toHaveURL("/leader/equipment");
  const itemId = (await inventoryCard.getAttribute("data-testid"))?.replace("equipment-inventory-card-", "");
  expect(incidentId).toBeTruthy();
  expect(itemId).toBeTruthy();
  await expect.poll(() => notificationCalls).toBe(1);

  const targetPath = `/leader/equipment/${itemId}?issue=${incidentId}`;
  const recipientContext = await browser.newContext();
  const recipientPage = await recipientContext.newPage();
  await recipientPage.goto(targetPath);
  await expect(recipientPage).toHaveURL(/\/leader\/login$/);
  await recipientPage.getByLabel("Email address").fill(account.email);
  await recipientPage.getByLabel("Password").fill(account.password);
  await recipientPage.getByRole("button", { name: "Sign In" }).click();
  await expect(recipientPage).toHaveURL(new RegExp(`/leader/equipment/${itemId}\\?issue=${incidentId}$`));
  await expect(recipientPage.getByRole("heading", { name: itemName, exact: true })).toBeVisible();
  await expect(recipientPage.getByTestId(`equipment-incident-${incidentId}`)).toContainText(description);
  await recipientContext.close();

  const outOfScopeContext = await browser.newContext();
  const outOfScopePage = await outOfScopeContext.newPage();
  await loginLeader(outOfScopePage, { email: process.env.E2E_MULTI_SECTION_LEADER_EMAIL || "test.multi.section.leader@example.com", password: account.password });
  await outOfScopePage.goto(targetPath);
  await expect(outOfScopePage.getByTestId("equipment-issue-fallback")).toBeVisible();
  await expect(outOfScopePage.getByText(description, { exact: true })).toHaveCount(0);
  await outOfScopeContext.close();
});
