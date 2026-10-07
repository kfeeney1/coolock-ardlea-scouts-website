import { expect, test, type Page } from "@playwright/test";

type Credentials = { email: string; password: string };

async function loginLeader(page: Page, account: Credentials) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  const leaderNavigation = page.waitForURL((url) => url.pathname === "/leader");
  await page.getByRole("button", { name: "Sign In" }).click();
  await leaderNavigation;
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("section Scouter can check equipment in and out from Programme without QM management access", async ({ page }) => {
  const email = process.env.E2E_LEADER_EMAIL?.trim();
  const password = process.env.E2E_TEST_USER_PASSWORD;
  test.skip(!email || !password, "Configure canonical section Scouter credentials.");
  await loginLeader(page, { email: email!, password: password! });
  await page.goto("/leader/weekly");
  await page.getByRole("button", { name: /Leader Menu|Menu ·/ }).click();
  await expect(page.locator('[data-testid="leader-nav-programme-equipment"]:visible')).toBeVisible();
  await page.locator('[data-testid="leader-nav-programme-equipment"]:visible').click();
  await expect(page.getByTestId("page-programme-equipment")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Programme Equipment" })).toBeVisible();

  const itemCards = page.locator('[data-testid^="programme-equipment-item-"]');
  await expect(itemCards.first()).toBeVisible();
  const availableBefore = async (row: Locator) => {
    const label = await row.getByText(/Available · \d+/).textContent();
    return Number(label?.match(/Available · (\d+)/)?.[1] ?? 0);
  };
  let itemName = "", itemId = "", availableAtStart = 0;
  await page.getByRole("button", { name: "Check out equipment" }).click();
  const checkoutDialog = page.getByRole("dialog", { name: "Check out equipment" });
  const checkoutItems = checkoutDialog.locator('[data-testid^="equipment-checkout-item-"]');
  for (let index = 0; index < await checkoutItems.count(); index += 1) {
    const candidate = checkoutItems.nth(index);
    const details = await candidate.innerText();
    const match = details.match(/(\d+) available after/);
    if (Number(match?.[1] ?? 0) < 1) continue;
    itemName = details.split("\n")[0].trim();
    itemId = (await candidate.getAttribute("data-testid"))?.replace("equipment-checkout-item-", "") ?? "";
    availableAtStart = Number(match?.[1]);
    await candidate.getByRole("spinbutton").fill("1");
    break;
  }
  expect(itemName).not.toBe("");
  const sectionSelect = checkoutDialog.getByRole("combobox").first();
  if (!(await sectionSelect.innerText()).trim()) {
    await sectionSelect.click();
    await page.getByRole("option").first().click();
  }
  await checkoutDialog.getByRole("button", { name: "Confirm checkout" }).click();
  await expect(checkoutDialog).toBeHidden();

  await page.reload();
  await expect(page.getByTestId("page-programme-equipment")).toBeVisible();
  const itemCard = page.getByTestId(`programme-equipment-item-${itemId}`);
  await expect(itemCard.getByText(/Checked out · \d+/)).toBeVisible();
  await expect.poll(() => availableBefore(itemCard)).toBe(availableAtStart - 1);

  const ownedLoan = page.locator('[data-testid^="equipment-loan-"]').filter({ hasText: itemName }).filter({ has: page.getByTestId("equipment-loan-owner") }).first();
  await expect(ownedLoan.getByTestId("equipment-loan-owner")).toContainText("Checked out by you");
  await ownedLoan.getByRole("button", { name: "Return equipment" }).click();
  const returnDialog = page.getByRole("dialog", { name: /Return equipment/ });
  await expect(returnDialog).toBeVisible();
  await returnDialog.getByRole("spinbutton", { name: "Return" }).fill("1");
  await returnDialog.getByRole("button", { name: "Confirm return" }).click();
  await expect(returnDialog).toBeHidden();
  await expect.poll(() => availableBefore(itemCard)).toBe(availableAtStart);

  await page.goto("/leader/equipment?view=quartermaster");
  await expect(page.getByRole("button", { name: "Add equipment" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Manage Stores" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Manage categories" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Equipment Reports" })).toHaveCount(0);
});
