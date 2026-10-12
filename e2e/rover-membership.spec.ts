import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

async function loginAdmin(page: Page, email = "test.webadmin@example.com") {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function signOutLeader(page: Page) {
  // Reset transient dialogs and their browser-history markers before opening
  // the header menu to switch the signed-in test account.
  await page.goto("/leader/profile");
  const header = page.getByTestId("leader-dashboard-header");
  const signOut = header.getByRole("button", { name: "Sign Out", exact: true });
  if (!(await signOut.isVisible().catch(() => false))) {
    await header.getByRole("button", { name: /^(?:Menu ·|Open Leader Menu|Hide Leader Menu)/ }).click();
  }
  await expect(signOut).toBeVisible();
  await page.evaluate(() => {
    const header = document.querySelector('[data-testid="leader-dashboard-header"]');
    const button = Array.from(header?.querySelectorAll("button") ?? [])
      .find((item) => item.textContent?.trim() === "Sign Out");
    if (!button) throw new Error("Sign Out button was detached before dispatch.");
    button.click();
  });
  await expect(page).toHaveURL(/\/leader\/login$/);
}

test("adult leader Rover self-service persists, appears in Member Management and can be ended", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Rover membership mutation runs once on desktop Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/profile");
  const leaderDisplayName = await page.getByLabel("Display name").inputValue();

  const panel = page.getByTestId("rover-self-membership");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: /Join Rovers|End Rover Membership/ })).toBeVisible();
  const join = panel.getByRole("button", { name: "Join Rovers" });
  if (await join.isVisible().catch(() => false)) {
    await expect(panel.getByLabel("First name")).not.toHaveValue("");
    await expect(panel.getByLabel("Last name")).not.toHaveValue("");
    await join.click();
    await expect(panel.getByText("Your Rover membership is active and linked to your account.")).toBeVisible();
  }

  await signOutLeader(page);
  await loginAdmin(page);
  await page.goto("/leader/profile");
  await expect(panel.getByRole("button", { name: "End Rover Membership" })).toBeVisible();
  await page.goto("/leader/members");
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Rovers", exact: true }).click();
  const cards = page.locator("[data-testid^='member-card-']");
  await expect(cards.filter({ hasText: leaderDisplayName })).toHaveCount(1);

  await page.goto("/leader/profile");
  const end = page.getByTestId("rover-self-membership").getByRole("button", { name: "End Rover Membership" });
  await end.click();
  await expect(page.getByText("Your Rover membership has ended.")).toBeVisible();
  await signOutLeader(page);
  await loginAdmin(page);
  await page.goto("/leader/profile");
  await expect(page.getByTestId("rover-self-membership").getByRole("button", { name: "Join Rovers" })).toBeVisible();
});

test("Rover self-service remains usable on the mobile profile layout", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile profile coverage runs once on Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/profile");
  const panel = page.getByTestId("rover-self-membership");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Explicitly join or leave Rovers.")).toBeVisible();
  await expect(panel.getByRole("button", { name: /Join Rovers|End Rover Membership/ })).toBeVisible();
});

test("authorized Member Management can end Rover membership from the member record", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Rover membership mutation runs once on desktop Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/members");

  // Create a legacy unlinked record first so this journey proves the manager
  // links the existing identity and preserves its Scouts membership.
  const existingCards = page.locator("[data-testid^='member-card-']").filter({ hasText: "Scouts Section Leader" });
  await expect(existingCards).toHaveCount(0);
  await page.getByRole("button", { name: "Add Member" }).click();
  const addDialog = page.getByRole("dialog", { name: "Add Existing Member" });
  await addDialog.getByLabel("First name").fill("Scouts");
  await addDialog.getByLabel("Last name").fill("Section Leader");
  await addDialog.getByLabel("Date of birth").fill("1985-01-01");
  await addDialog.getByLabel("Email address").fill("test.scout.section.leader@example.com");
  await addDialog.getByRole("checkbox", { name: "Scouts" }).check();
  await addDialog.getByRole("button", { name: "Add Member" }).click();
  await expect(addDialog).toBeHidden();

  await signOutLeader(page);
  await loginAdmin(page, "test.group.leader@example.com");
  await page.goto("/leader/members");

  const manageRovers = page.getByRole("button", { name: "Manage Rovers" });
  await expect(manageRovers).toBeVisible();
  await manageRovers.click();
  const managementDialog = page.getByRole("dialog", { name: "Manage Rover Membership" });
  const target = managementDialog.getByText("Scouts Section Leader", { exact: true });
  await expect(target).toBeVisible();
  const targetRow = target.locator("xpath=ancestor::div[contains(@class,'MuiPaper-root')][1]");
  const designate = targetRow.getByRole("button", { name: "Designate Rover" });
  if (await designate.isVisible().catch(() => false)) {
    await designate.click();
    await expect(targetRow.getByRole("button", { name: "End Rover Membership" })).toBeVisible();
  }
  await managementDialog.getByRole("button", { name: "Close" }).click();
  await expect(managementDialog).toBeHidden();

  const roverFilter = page.getByRole("combobox", { name: "Section" });
  await roverFilter.click();
  await page.getByRole("option", { name: "Rovers", exact: true }).click();
  const memberCard = page.locator("[data-testid^='member-card-']").filter({ hasText: "Scouts Section Leader" });
  await expect(memberCard).toHaveCount(1);
  await expect(memberCard).toContainText("Scouts");
  await expect(memberCard).toContainText("Rovers");
  const existingMemberId = await memberCard.getAttribute("data-testid");
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "All Sections", exact: true }).click();
  const allSectionsCard = page.getByTestId(existingMemberId!);
  await expect(allSectionsCard).toHaveCount(1);
  await expect(allSectionsCard).toContainText("Scouts");
  await expect(allSectionsCard).toContainText("Rovers");
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Rovers", exact: true }).click();
  const roverMemberCard = page.getByTestId(existingMemberId!);
  await expect(roverMemberCard).toBeVisible();
  const roverEligibility = await roverMemberCard.evaluate((element) => ({
    status: element.getAttribute("data-member-status"),
    hasRovers: element.getAttribute("data-member-has-rovers"),
    accountLinked: element.getAttribute("data-member-account-linked"),
    candidateMatch: element.getAttribute("data-member-rover-candidate-match")
  }));
  await roverMemberCard.getByRole("button", { name: "Manage", exact: true }).click();

  const memberDetailsHeading = page.getByRole("heading", { name: "Member Details", exact: true });
  await expect(memberDetailsHeading).toBeVisible();
  expect(roverEligibility.status, JSON.stringify(roverEligibility)).toBe("active");
  expect(roverEligibility.hasRovers, JSON.stringify(roverEligibility)).toBe("true");
  expect(
    roverEligibility.accountLinked === "true" || roverEligibility.candidateMatch === "true",
    JSON.stringify(roverEligibility)
  ).toBe(true);
  const endMembership = page.getByTestId("member-rover-membership-actions")
    .getByRole("button", { name: "End Rover Membership" });
  const editorSections = await page.locator('input[type="checkbox"]').evaluateAll((inputs) => inputs.map((element) => {
    const input = element as HTMLInputElement;
    return { section: input.getAttribute("aria-label"), checked: input.checked };
  }));
  const editorStatus = await page.locator("select").evaluateAll((selects) => selects.map((element) => (element as HTMLSelectElement).value));
  const pageText = await page.locator("body").evaluate((element) => element.textContent?.slice(-1200) ?? "");
  try {
    await expect(endMembership).toBeVisible();
  } catch {
    throw new Error(`Rover editor diagnostic: ${JSON.stringify({ roverEligibility, editorStatus, editorSections, pageText })}`);
  }
  await endMembership.click();
  await expect(page.getByText("Rover membership ended and the member record is no longer in your section scope.")).toBeVisible();
  await expect(memberDetailsHeading).toBeHidden();

  await signOutLeader(page);
  await loginAdmin(page);
  await page.goto("/leader/members");
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "All Sections", exact: true }).click();
  const retainedCard = page.getByTestId(existingMemberId!);
  await expect(retainedCard).toContainText("Scouts");
  await expect(retainedCard).not.toContainText("Rovers");
  await expect(retainedCard).toContainText("Active");
  await page.reload();
  const reloadedCard = page.getByTestId(existingMemberId!);
  await expect(reloadedCard).toContainText("Scouts");
  await expect(reloadedCard).not.toContainText("Rovers");
  await expect(reloadedCard).toContainText("Active");
});

test("a Programme Scouter cannot open Rover membership management", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Rover role denial runs once on desktop Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page, "test.cub.programme.scouter@example.com");
  await page.goto("/leader/members");
  await expect(page.getByRole("button", { name: "Manage Rovers" })).toHaveCount(0);
});

test("Rover Section Leader can designate and remove a member on mobile", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile manager workflow runs once on Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page, "test.rover.section.leader@example.com");
  await page.goto("/leader/members");
  const manageRovers = page.getByRole("button", { name: "Manage Rovers" });
  await expect(manageRovers).toBeVisible();
  await manageRovers.click();
  const dialog = page.getByRole("dialog", { name: "Manage Rover Membership" });
  const target = dialog.getByText("Cubs Section Leader", { exact: true });
  const row = target.locator("xpath=ancestor::div[contains(@class,'MuiPaper-root')][1]");
  await expect(row.getByRole("button", { name: "Designate Rover" })).toBeVisible();
  await row.getByRole("button", { name: "Designate Rover" }).click();
  await expect(row.getByRole("button", { name: "End Rover Membership" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.reload();
  await page.getByRole("button", { name: "Manage Rovers" }).click();
  const reopened = page.getByRole("dialog", { name: "Manage Rover Membership" });
  const persistedRow = reopened.getByText("Cubs Section Leader", { exact: true }).locator("xpath=ancestor::div[contains(@class,'MuiPaper-root')][1]");
  await expect(persistedRow.getByRole("button", { name: "End Rover Membership" })).toBeVisible();
  await persistedRow.getByRole("button", { name: "End Rover Membership" }).click();
  await expect(persistedRow.getByRole("button", { name: "Designate Rover" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await reopened.getByRole("button", { name: "Close" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Manage Rovers" }).click();
  const afterRemoval = page.getByRole("dialog", { name: "Manage Rover Membership" });
  const removedRow = afterRemoval.getByText("Cubs Section Leader", { exact: true }).locator("xpath=ancestor::div[contains(@class,'MuiPaper-root')][1]");
  await expect(removedRow.getByRole("button", { name: "Designate Rover" })).toBeVisible();
});
