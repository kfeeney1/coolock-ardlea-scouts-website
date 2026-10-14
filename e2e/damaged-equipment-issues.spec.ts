import { expect, test, type Locator, type Page } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL?.trim();
const password = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;

async function signIn(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).toHaveURL(/\/leader$/);
}

async function chooseEquipmentIssueOption(page: Page, field: Locator, optionName: string) {
  await field.click();
  const listbox = page.getByRole("listbox").filter({ has: page.getByRole("option", { name: optionName, exact: true }) });
  await expect(listbox).toBeVisible();
  await listbox.getByRole("option", { name: optionName, exact: true }).click();
  // The MUI Select menu is a nested modal portal. Wait for it to release
  // accessibility focus back to the issue dialog before querying its field.
  await expect(listbox).toBeHidden();
  await expect(field).toHaveText(optionName);
}

test("damaged equipment issues keep independent state and dashboard tiles open their exact records", async ({ page }, testInfo) => {
  test.skip(!email || !password, "Configure E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD.");
  test.setTimeout(120_000);

  const suffix = `${testInfo.project.name} ${Date.now()}`;
  const firstName = `TEST Long-name canvas patrol tent for the expedition equipment store ${suffix}`;
  const secondName = `TEST Long-name expedition cooker ${suffix}`;
  const storeName = `TEST Incident Store ${suffix}`;
  const firstDescription = "First independent issue: " + "the tent seam is split and rain enters near the door; ".repeat(5) + ` Contact ${"equipment".repeat(12)}@example.test; reference ${"ID".repeat(80)}.`;
  const secondDescription = "Second independent issue: " + "the cooker valve sticks and requires a safety inspection; ".repeat(5);

  await signIn(page);
  await page.goto("/leader/equipment");

  const itemIds = new Map<string, string>();
  for (const [name, createStore] of [[firstName, true], [secondName, false]] as const) {
    await page.getByRole("button", { name: "Add equipment" }).click();
    const dialog = page.getByRole("dialog", { name: "Add equipment" });
    await dialog.getByLabel("Equipment name").fill(name);
    await dialog.getByLabel("Category").click();
    await page.getByRole("option", { name: "Camping & Sleeping" }).click();
    await dialog.getByLabel("Store").click();
    if (createStore) {
      await page.getByRole("option", { name: "Other…" }).click();
      await dialog.getByLabel("New Store").fill(storeName);
    } else {
      await page.getByRole("option", { name: storeName, exact: true }).click();
    }
    await dialog.getByLabel("Total quantity").fill("1");
    await dialog.getByRole("button", { name: "Save equipment" }).click();
    await expect(dialog).toBeHidden();
    const inventoryCard = page.locator('[data-testid^="equipment-inventory-card-"]').filter({ hasText: name });
    await expect(inventoryCard).toBeVisible();
    itemIds.set(name, (await inventoryCard.getAttribute("data-testid"))!.replace("equipment-inventory-card-", ""));
  }

  const incidentIds = new Map<string, string>();
  for (const [name, description] of [[firstName, firstDescription], [secondName, secondDescription]] as const) {
    await page.getByRole("button", { name: "Report issue" }).click();
    const report = page.getByRole("dialog", { name: "Report equipment issue" });
    await chooseEquipmentIssueOption(page, report.getByLabel("Equipment / checkout"), `Store · ${name} · 1 available`);
    await chooseEquipmentIssueOption(page, report.getByLabel("Issue type"), "Broken / damaged");
    await report.getByLabel("Quantity affected").fill("1");
    await report.getByLabel("What happened?").fill(description);
    await report.getByRole("button", { name: "Report issue" }).click();
    await expect(report).toBeHidden();
    const inventoryCard = page.getByTestId(`equipment-inventory-card-${itemIds.get(name)}`);
    await expect(inventoryCard.getByText("0 available", { exact: true })).toBeVisible();
    await expect(inventoryCard.getByText("1 unavailable", { exact: true })).toBeVisible();
    await expect(page.getByTestId("equipment-incidents-panel").getByTestId(/^equipment-incident-/)).toHaveCount(0);
  }

  // SW-366: preserve the complete operational text and record action while
  // containing card borders, text and date badges at responsive widths.
  const activityList = page.getByTestId("equipment-recent-activity");
  const firstActivity = activityList.getByRole("link").filter({ hasText: firstName });
  await expect(firstActivity).toContainText(firstDescription);
  const originalViewport = page.viewportSize()!;
  for (const width of [320, 412, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(firstActivity).toBeVisible();
    await expect(firstActivity).toHaveAttribute("href", new RegExp(`/leader/equipment/${itemIds.get(firstName)}\\?issue=`));
    await expect.poll(() => activityList.evaluate((list) => {
      const bounds = list.getBoundingClientRect();
      return Array.from(list.children).every((tile) => {
        const rect = tile.getBoundingClientRect();
        return rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1
          && tile.scrollWidth <= tile.clientWidth + 1
          && Array.from(tile.querySelectorAll(".MuiTypography-root, .MuiChip-root")).every((child) => {
            const childRect = child.getBoundingClientRect();
            return childRect.left >= rect.left - 1 && childRect.right <= rect.right + 1
              && child.scrollWidth <= child.clientWidth + 1;
          });
      });
    })).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(firstActivity).toContainText(firstName);
    await expect(firstActivity).toContainText(firstDescription);
    await expect(firstActivity.locator(".MuiChip-label")).toHaveText(/\d{2}-\d{2}-\d{4}/);
  }
  await page.setViewportSize(originalViewport);
  await firstActivity.click();
  await expect(page).toHaveURL(new RegExp(`/leader/equipment/${itemIds.get(firstName)}\\?issue=`));
  await expect(page.getByTestId("equipment-record-summary")).toBeVisible();
  await page.goto("/leader/equipment");

  await page.getByRole("button", { name: "Check out equipment" }).click();
  const checkout = page.getByRole("dialog", { name: "Check out equipment" });
  for (const name of [firstName, secondName]) {
    const card = checkout.getByTestId(`equipment-checkout-item-${itemIds.get(name)}`);
    await expect(card).toContainText("0 available after current checkouts and reservations");
    await expect(card.getByRole("spinbutton", { name: `Qty for ${name}` })).toBeDisabled();
  }
  await checkout.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByRole("link", { name: "View reported issues" })).toBeVisible();
  await page.getByRole("link", { name: "View reported issues" }).click();
  await expect(page).toHaveURL("/leader/equipment/issues");
  await expect(page.getByTestId("page-qm-equipment-issues")).toBeVisible();
  for (const [name, description] of [[firstName, firstDescription], [secondName, secondDescription]] as const) {
    const tile = page.locator('[data-testid^="equipment-incident-"]').filter({ hasText: name });
    await expect(tile).toContainText(description);
    const id = (await tile.getAttribute("data-testid"))?.replace("equipment-incident-", "");
    expect(id).toBeTruthy();
    incidentIds.set(name, id!);
  }

  const first = page.getByTestId(`equipment-incident-${incidentIds.get(firstName)}`);
  const second = page.getByTestId(`equipment-incident-${incidentIds.get(secondName)}`);
  await expect(page.locator('[data-testid^="equipment-incident-"]').filter({ hasText: firstName })).toHaveCount(1);
  await expect(page.locator('[data-testid^="equipment-incident-"]').filter({ hasText: secondName })).toHaveCount(1);
  await expect(first).toContainText(firstDescription);
  await expect(second).toContainText(secondDescription);

  await page.getByRole("link", { name: "Back to Equipment & Stores" }).click();
  await expect(page).toHaveURL("/leader/equipment");
  await page.getByRole("link", { name: "View reported issues" }).click();
  await expect(page).toHaveURL("/leader/equipment/issues");

  await first.getByRole("button", { name: "Start investigation" }).click();
  await expect(first.getByText("Investigating", { exact: true })).toBeVisible();
  await expect(second.getByText("Reported", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId(`equipment-incident-${incidentIds.get(firstName)}`).getByText("Investigating", { exact: true })).toBeVisible();
  await expect(page.getByTestId(`equipment-incident-${incidentIds.get(secondName)}`).getByText("Reported", { exact: true })).toBeVisible();

  await page.goto("/leader");
  const dashboard = page.getByTestId("needs-attention-card");
  const firstAlert = dashboard.getByTestId(`attention-tile-equipment-incident-${incidentIds.get(firstName)}`);
  const secondAlert = dashboard.getByTestId(`attention-tile-equipment-incident-${incidentIds.get(secondName)}`);
  await expect(firstAlert).toHaveAttribute("href", `/leader/equipment/${itemIds.get(firstName)}?issue=${incidentIds.get(firstName)}`);
  await expect(secondAlert).toHaveAttribute("href", `/leader/equipment/${itemIds.get(secondName)}?issue=${incidentIds.get(secondName)}`);
  await expect(secondAlert).toBeVisible();
  // The same long equipment details also appear on the leader dashboard.
  // Their text must stay inside the clickable tile, clear of neighbouring cards.
  await expect.poll(() => firstAlert.evaluate((tile) => {
    const bounds = tile.getBoundingClientRect();
    return tile.scrollWidth <= tile.clientWidth + 1
      && Array.from(tile.querySelectorAll(".MuiTypography-root")).every((text) => {
        const rect = text.getBoundingClientRect();
        return rect.left >= bounds.left && rect.right <= bounds.right
          && rect.top >= bounds.top && rect.bottom <= bounds.bottom
          && text.scrollWidth <= text.clientWidth + 1;
      });
  })).toBe(true);
  await secondAlert.getByText(secondDescription).click();
  await expect(page).toHaveURL(`/leader/equipment/${itemIds.get(secondName)}?issue=${incidentIds.get(secondName)}`);
  await expect(page.getByTestId(`equipment-incident-${incidentIds.get(secondName)}`)).toContainText(secondDescription);
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/leader$/);

  const firstAlertAfterBack = page.getByTestId("needs-attention-card").getByTestId(`attention-tile-equipment-incident-${incidentIds.get(firstName)}`);
  await firstAlertAfterBack.getByText(firstDescription).click();
  await expect(page).toHaveURL(`/leader/equipment/${itemIds.get(firstName)}?issue=${incidentIds.get(firstName)}`);
  const recordHistoryIndex = await page.evaluate(() => window.history.state?.idx as number | undefined);
  expect(typeof recordHistoryIndex).toBe("number");
  await page.getByTestId(`equipment-incident-${incidentIds.get(firstName)}`).getByRole("button", { name: "Resolve" }).click();
  const resolve = page.getByRole("dialog", { name: "Resolve equipment issue" });
  await resolve.getByLabel("Resolution notes").fill("Repaired and checked independently.");
  await resolve.getByRole("button", { name: "Confirm resolution" }).click();
  await expect(resolve).toBeHidden();
  // The dialog becomes hidden before the overlay bridge finishes consuming its
  // same-route history entry. Wait for that POP before using the record's own Back link.
  await expect.poll(() => page.evaluate(() => window.history.state?.idx as number | undefined)).toBe(recordHistoryIndex);
  await expect(page.getByTestId(`equipment-incident-${incidentIds.get(firstName)}`)).toHaveCount(0);

  // Continue through the same visible dashboard tile a leader would use. This
  // keeps the tile-to-record assertion on the SPA path after the resolve dialog
  // has finished closing and its history entry has been consumed.
  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/leader$/);
  const secondAlertAfterResolution = page.getByTestId("needs-attention-card").getByTestId(`attention-tile-equipment-incident-${incidentIds.get(secondName)}`);
  await secondAlertAfterResolution.click();
  await expect(page).toHaveURL(`/leader/equipment/${itemIds.get(secondName)}?issue=${incidentIds.get(secondName)}`);
  await expect(page.getByTestId("equipment-record-summary")).toBeVisible();
  await expect(page.getByTestId(`equipment-incident-${incidentIds.get(secondName)}`).getByText("Reported", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("equipment-record-summary")).toBeVisible();
  await expect(page.getByTestId(`equipment-incident-${incidentIds.get(secondName)}`).getByText("Reported", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/leader$/);
  await page.goto(`/leader/equipment/${itemIds.get(firstName)}?issue=${incidentIds.get(firstName)}`);

  await page.getByRole("button", { name: "History", exact: true }).click();
  const history = page.getByRole("dialog", { name: `${firstName} history` });
  await expect(history.getByText("Issue reported", { exact: true })).toBeVisible();
  await expect(history.getByText("Issue under investigation", { exact: true })).toBeVisible();
  await expect(history.getByText("Issue resolved", { exact: true })).toBeVisible();
  await history.getByRole("button", { name: "Close" }).click();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
