import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const seededJourneyData = process.env.E2E_LEADER_JOURNEY_SEEDED === "true";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Leader access management checks run once on desktop Chromium.");
}

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(adminEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function viewportState(page: Page) {
  return page.evaluate(() => ({
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    clientWidth: document.documentElement.clientWidth
  }));
}

test.describe("leader access management", () => {
  test("admin reviews section-aware controls and cancels an account deactivation before any persisted change", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");
    test.skip(!seededJourneyData, "Canonical leader journey seed data is required.");

    await loginAdmin(page);
    await page.goto("/leader/access");
    await expect(page.getByRole("heading", { name: "Leader Access & Organisation" })).toBeVisible();

    const tile = page.getByTestId("leader-access-tile-TEST_uid_multi_section_leader");
    await expect(tile).toContainText("Test Multi Section Leader");
    await expect(tile).toContainText(/Programme Scouter|Scouter/);
    await tile.click();
    await expect(page).toHaveURL(/\/leader\/access\/TEST_uid_multi_section_leader/);
    const card = page.getByTestId("leader-access-TEST_uid_multi_section_leader");
    await expect(card).toContainText("Test Multi Section Leader");

    const cubsSection = card.getByRole("button", { name: "Cubs", exact: true });
    await expect(cubsSection).toBeVisible();
    await expect(cubsSection).toHaveAttribute("data-section", "Cubs");
    await expect(cubsSection).toHaveAttribute("aria-pressed", /true|false/);
    await expect(cubsSection.getByTestId("section-icon-cubs")).toBeVisible();

    await expect(card.getByRole("combobox", { name: "Organisation section" })).toHaveCount(0);
    await expect(card.getByText("Appointment scope follows the leader's Account sections.")).toBeVisible();


    const saveLeader = card.getByRole("button", { name: "Save Leader" });
    await expect(saveLeader).toBeDisabled();
    const active = card.getByRole("switch", { name: "Active" });
    await expect(active).toBeChecked();
    await active.click();
    await expect(active).not.toBeChecked();
    await expect(saveLeader).toBeEnabled();

    await saveLeader.click();

    const dialog = page.getByRole("dialog", { name: "Confirm leader access changes?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Test Multi Section Leader");
    await expect(dialog).toContainText("Account access will be disabled.");
    await expect(dialog.getByRole("button", { name: "Confirm Changes" })).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(active).not.toBeChecked();

    await active.click();
    await expect(active).toBeChecked();
    await expect(saveLeader).toBeDisabled();

    await page.reload();
    await expect(page.getByTestId("leader-access-TEST_uid_multi_section_leader").getByRole("switch", { name: "Active" })).toBeChecked();
  });
});


test("leader access summary tiles filter and direct routes use stable IDs", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !adminEmail || !seededJourneyData, "Canonical leader journey seed data is required.");
  await loginAdmin(page);
  await page.goto("/leader/access");
  const search = page.getByLabel("Search leaders");
  await search.fill("Test Multi Section Leader");
  const tile = page.getByRole("button", { name: "Edit leader access for Test Multi Section Leader" });
  await expect(tile).toHaveCount(1);
  await tile.press("Enter");
  await expect(page).toHaveURL(/\/leader\/access\/TEST_uid_multi_section_leader/);
  await expect(page.getByTestId("leader-access-TEST_uid_multi_section_leader")).toBeVisible();
  await page.getByRole("button", { name: "Back to leaders" }).click();
  await expect(search).toHaveValue("Test Multi Section Leader");
  await page.goto("/leader/access/not-a-real-leader");
  await expect(page.getByText("Leader record not found or is not available to you.")).toBeVisible();
});


test("SW-219 leader-child link persists and automatically reconciles current-year Subs", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !adminEmail || !seededJourneyData, "Canonical leader journey seed data is required.");
  await loginAdmin(page);

  const leaderUid = "TEST_uid_multi_section_leader";
  const memberName = "Cub Child 02";
  await page.goto(`/leader/access/${leaderUid}`);
  const card = page.getByTestId(`leader-access-${leaderUid}`);
  await expect(card).toContainText("Test Multi Section Leader");
  await expect(card.getByTestId("leader-child-links")).toBeVisible();

  const childSelect = card.getByRole("combobox", { name: "Child member" });
  await childSelect.click();
  const childOption = page.getByRole("option", { name: new RegExp(`Cub.*02.*Cubs`, "i") }).first();
  await expect(childOption).toBeVisible();
  const optionText = (await childOption.textContent())?.split(" · ")[0]?.trim() || memberName;
  await childOption.click();
  await card.getByRole("button", { name: "Link child" }).click();
  await expect(page.getByText("Leader-child relationship linked. Current Scout-year family Subs classification has been reconciled.")).toBeVisible();
  await expect(card).toContainText(optionText);

  await page.reload();
  await expect(page.getByTestId(`leader-access-${leaderUid}`)).toContainText(optionText);

  await page.goto("/leader/subs");
  await page.getByRole("tab", { name: "Balances & reports" }).click();
  const leaderRevision = page.locator('[data-testid^="subs-report-row-family-2026-27--TEST_member_cub_02"]').filter({ hasText: "Leader family" });
  await expect(leaderRevision).toContainText("Leader family");
  await expect(leaderRevision).toContainText("€70.00 due");

  await page.goto(`/leader/access/${leaderUid}`);
  const reloadedCard = page.getByTestId(`leader-access-${leaderUid}`);
  const linkedRow = reloadedCard.getByText(optionText).locator("..");
  await linkedRow.getByRole("button", { name: "Unlink" }).click();
  await expect(page.getByText("Leader-child relationship unlinked. Current Scout-year family Subs classification has been reconciled.")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId(`leader-access-${leaderUid}`)).not.toContainText(optionText);

  await page.goto("/leader/subs");
  await page.getByRole("tab", { name: "Balances & reports" }).click();
  const standardRevision = page.locator('[data-testid^="subs-report-row-family-2026-27--TEST_member_cub_02"]').filter({ hasText: "Standard family" });
  await expect(standardRevision).toContainText("Standard family");
  await expect(standardRevision).toContainText("€100.00 due");
});
