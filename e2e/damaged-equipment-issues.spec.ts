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
  const firstName = `TEST Long-name canvas patrol tent ${suffix}`;
  const secondName = `TEST Long-name expedition cooker ${suffix}`;
  const storeName = `TEST Incident Store ${suffix}`;
  const firstDescription = "First independent issue: " + "the tent seam is split and rain enters near the door; ".repeat(5);
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
    await expect(page.getByTestId("equipment-incidents-panel").getByTestId(/^equipment-incident-/)).toHaveCount(0);
  }

  await expect(page.getByRole("button", { name: "View reported issues" })).toBeVisible();
  await page.getByRole("button", { name: "View reported issues" }).click();
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

  await page.getByRole("button", { name: "Back to Equipment & Stores" }).click();
  await expect(page).toHaveURL("/leader/equipment");
  await page.getByRole("button", { name: "View reported issues" }).click();
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
  await secondAlert.getByText(secondDescription).click();
  await expect(page).toHaveURL(`/leader/equipment/${itemIds.get(secondName)}?issue=${incidentIds.get(secondName)}`);
  await expect(page.getByTestId(`equipment-incident-${incidentIds.get(secondName)}`)).toContainText(secondDescription);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/leader$/);

  const firstAlertAfterBack = page.getByTestId("needs-attention-card").getByTestId(`attention-tile-equipment-incident-${incidentIds.get(firstName)}`);
  await firstAlertAfterBack.getByText(firstDescription).click();
  await expect(page).toHaveURL(`/leader/equipment/${itemIds.get(firstName)}?issue=${incidentIds.get(firstName)}`);
  await page.getByTestId(`equipment-incident-${incidentIds.get(firstName)}`).getByRole("button", { name: "Resolve" }).click();
  const resolve = page.getByRole("dialog", { name: "Resolve equipment issue" });
  await resolve.getByLabel("Resolution notes").fill("Repaired and checked independently.");
  await resolve.getByRole("button", { name: "Confirm resolution" }).click();
  await expect(resolve).toBeHidden();
  await expect(page.getByTestId(`equipment-incident-${incidentIds.get(firstName)}`)).toHaveCount(0);

  // Continue through the same visible dashboard tile a leader would use. This
  // keeps the tile-to-record assertion on the SPA path after the resolve dialog
  // has finished closing and its history entry has been consumed.
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page).toHaveURL(/\/leader$/);
  const secondAlertAfterResolution = page.getByTestId("needs-attention-card").getByTestId(`attention-tile-equipment-incident-${incidentIds.get(secondName)}`);
  await secondAlertAfterResolution.click();
  await expect(page).toHaveURL(`/leader/equipment/${itemIds.get(secondName)}?issue=${incidentIds.get(secondName)}`);
  await expect(page.getByTestId("equipment-record-summary")).toBeVisible();
  await expect(page.getByTestId(`equipment-incident-${incidentIds.get(secondName)}`).getByText("Reported", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("equipment-record-summary")).toBeVisible();
  await expect(page.getByTestId(`equipment-incident-${incidentIds.get(secondName)}`).getByText("Reported", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Back", exact: true }).click();
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
