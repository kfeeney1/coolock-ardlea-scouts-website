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
    await expect(card.getByText(/Appointments may be held by multiple leaders.*Account sections\./)).toBeVisible();


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


test("SW-153 filters preserve the working viewport on desktop, mobile, and keyboard changes", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !adminEmail || !seededJourneyData, "Canonical leader journey seed data is required.");

  const exerciseFilters = async (width: number, height: number) => {
    await page.setViewportSize({ width, height });
    await page.goto("/leader/access");
    const search = page.getByLabel("Search leaders");
    await expect(search).toBeVisible();
    await search.scrollIntoViewIfNeeded();

    const filterPosition = async () => search.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewportHeight: window.innerHeight };
    });
    const expectWorkingViewport = async (before: Awaited<ReturnType<typeof filterPosition>>) => {
      const after = await filterPosition();
      expect(after.top).toBeLessThan(after.viewportHeight);
      expect(after.bottom).toBeGreaterThan(0);
      expect(Math.abs(after.top - before.top)).toBeLessThan(after.viewportHeight / 2);
    };

    let before = await filterPosition();
    await search.fill("Test");
    await expect(search).toHaveValue("Test");
    await expect(page).toHaveURL(/q=Test/);
    await expectWorkingViewport(before);

    before = await filterPosition();
    await search.fill("Test Multi");
    await expect(page.getByRole("button", { name: "Edit leader access for Test Multi Section Leader" })).toHaveCount(1);
    await expectWorkingViewport(before);

    before = await filterPosition();
    await search.clear();
    await expect(search).toHaveValue("");
    await expect(page).not.toHaveURL(/q=/);
    await expectWorkingViewport(before);

    before = await filterPosition();
    await search.focus();
    await search.pressSequentially("Test");
    await expect(search).toHaveValue("Test");
    await expectWorkingViewport(before);

    const tile = page.getByRole("button", { name: "Edit leader access for Test Multi Section Leader" });
    await tile.click();
    await expect(page).toHaveURL(/\/leader\/access\/TEST_uid_multi_section_leader\?q=Test/);
    await page.getByRole("button", { name: "Back to leaders" }).click();
    await expect(page.getByLabel("Search leaders")).toHaveValue("Test");
  };

  await loginAdmin(page);
  await exerciseFilters(1280, 420);
  await exerciseFilters(390, 500);
});


test("SW-248 allows two leaders to retain the same Group appointment independently", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !adminEmail || !seededJourneyData, "Canonical leader journey seed data is required.");
  await loginAdmin(page);

  const sharedAppointment = "Group Treasurer";
  const existingHolderUid = "TEST_uid_group_treasurer";
  const secondHolderUid = "TEST_uid_multi_section_leader";

  await page.goto(`/leader/access/${existingHolderUid}`);
  const existingHolder = page.getByTestId(`leader-access-${existingHolderUid}`);
  await expect(existingHolder.getByRole("checkbox", { name: sharedAppointment })).toBeChecked();

  await page.goto(`/leader/access/${secondHolderUid}`);
  let secondHolder = page.getByTestId(`leader-access-${secondHolderUid}`);
  let secondAppointment = secondHolder.getByRole("checkbox", { name: sharedAppointment });

  // Retries share the emulator state. Restore this fixture if a previous attempt
  // persisted the assignment before failing later in the journey.
  if (await secondAppointment.isChecked()) {
    await secondAppointment.uncheck();
    await secondHolder.getByRole("button", { name: "Save Leader" }).click();
    await page.getByRole("dialog", { name: "Confirm leader access changes?" }).getByRole("button", { name: "Confirm Changes" }).click();
    await expect(page.getByText("Test Multi Section Leader updated.")).toBeVisible();
    await page.goto(`/leader/access/${secondHolderUid}`);
    secondHolder = page.getByTestId(`leader-access-${secondHolderUid}`);
    secondAppointment = secondHolder.getByRole("checkbox", { name: sharedAppointment });
  }

  await expect(secondAppointment).not.toBeChecked();
  await secondAppointment.check();
  await secondHolder.getByRole("button", { name: "Save Leader" }).click();
  await page.getByRole("dialog", { name: "Confirm leader access changes?" }).getByRole("button", { name: "Confirm Changes" }).click();
  await expect(page.getByText("Test Multi Section Leader updated.")).toBeVisible();

  await page.goto(`/leader/access/${secondHolderUid}`);
  secondHolder = page.getByTestId(`leader-access-${secondHolderUid}`);
  await expect(secondHolder.getByRole("checkbox", { name: sharedAppointment })).toBeChecked();

  await page.goto(`/leader/access/${existingHolderUid}`);
  await expect(page.getByTestId(`leader-access-${existingHolderUid}`).getByRole("checkbox", { name: sharedAppointment })).toBeChecked();

  await page.goto(`/leader/access/${secondHolderUid}`);
  secondHolder = page.getByTestId(`leader-access-${secondHolderUid}`);
  await secondHolder.getByRole("checkbox", { name: sharedAppointment }).uncheck();
  await secondHolder.getByRole("button", { name: "Save Leader" }).click();
  await page.getByRole("dialog", { name: "Confirm leader access changes?" }).getByRole("button", { name: "Confirm Changes" }).click();
  await expect(page.getByText("Test Multi Section Leader updated.")).toBeVisible();

  await page.goto(`/leader/access/${existingHolderUid}`);
  await expect(page.getByTestId(`leader-access-${existingHolderUid}`).getByRole("checkbox", { name: sharedAppointment })).toBeChecked();
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
  await expect(card).toContainText(optionText);
  await expect(page.getByRole("alert")).toContainText(/relationship linked|reconciled|saved/i);

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


test("SW-257 places primary-section leaders before valid secondary-section matches", async ({ page }) => {
  test.skip(!password || !adminEmail || !seededJourneyData, "Canonical leader access fixtures are required.");
  await loginAdmin(page);

  const expectedCubsOrder = [
    "TEST_uid_cub_assistant_section_leader",
    "TEST_uid_cub_programme_scouter",
    "TEST_uid_cub_scouter",
    "TEST_uid_cub_section_leader",
    "TEST_uid_group_leader",
    "TEST_uid_multi_section_leader"
  ];

  const ids = async () => page.getByTestId("leader-access-summary-list")
    .locator('[data-testid^="leader-access-tile-"]')
    .evaluateAll((tiles) => tiles.map((tile) => tile.getAttribute("data-testid")!.replace("leader-access-tile-", "")));

  const exercise = async (width: number, height: number) => {
    await page.setViewportSize({ width, height });
    await page.goto("/leader/access");
    await expect(page.getByRole("heading", { name: "Leader Access & Organisation" })).toBeVisible();
    const allSectionsOrder = await ids();

    const sectionFilter = page.getByRole("combobox", { name: "Filter by section" });
    await sectionFilter.click();
    await page.getByRole("option", { name: "Cubs", exact: true }).click();
    await expect(page.getByTestId("leader-access-tile-TEST_uid_multi_section_leader")).toBeVisible();
    expect(await ids()).toEqual(expectedCubsOrder);

    const search = page.getByLabel("Search leaders");
    await search.fill("Cubs");
    expect(await ids()).toEqual(expectedCubsOrder);
    await page.reload();
    await expect(page.getByLabel("Search leaders")).toHaveValue("");
    const reloadedSectionFilter = page.getByRole("combobox", { name: "Filter by section" });
    await reloadedSectionFilter.click();
    await page.getByRole("option", { name: "Cubs", exact: true }).click();
    expect(await ids()).toEqual(expectedCubsOrder);

    await page.goto("/leader/access");
    expect(await ids()).toEqual(allSectionsOrder);
    await page.reload();
    expect(await ids()).toEqual(allSectionsOrder);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));
  };

  await exercise(1280, 900);
  await exercise(390, 844);
});
