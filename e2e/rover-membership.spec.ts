import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill("test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
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

  await page.reload();
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
  const existingCards = page.locator("[data-testid^='member-card-']").filter({ hasText: "Rovers Section Leader" });
  const existingCount = await existingCards.count();
  expect(existingCount).toBeLessThanOrEqual(1);
  const existingMemberId = existingCount === 1 ? await existingCards.getAttribute("data-testid") : null;

  const manageRovers = page.getByRole("button", { name: "Manage Rovers" });
  await expect(manageRovers).toBeVisible();
  await manageRovers.click();
  const managementDialog = page.getByRole("dialog", { name: "Manage Rover Membership" });
  const target = managementDialog.getByText("Rovers Section Leader", { exact: true });
  await expect(target).toBeVisible();
  const targetRow = target.locator("xpath=ancestor::div[contains(@class,'MuiPaper-root')][1]");
  const designate = targetRow.getByRole("button", { name: "Designate Rover" });
  if (await designate.isVisible().catch(() => false)) {
    await designate.click();
    await expect(targetRow.getByRole("button", { name: "End Rover Membership" })).toBeVisible();
  }
  await managementDialog.getByRole("button", { name: "Close" }).click();

  const roverFilter = page.getByRole("combobox", { name: "Section" });
  await roverFilter.click();
  await page.getByRole("option", { name: "Rovers", exact: true }).click();
  const memberCard = page.locator("[data-testid^='member-card-']").filter({ hasText: "Rovers Section Leader" });
  await expect(memberCard).toHaveCount(1);
  if (existingMemberId) await expect(memberCard).toHaveAttribute("data-testid", existingMemberId);
  await memberCard.getByRole("button", { name: "Manage" }).click();

  const memberDialog = page.getByRole("dialog", { name: "Member — Rovers Section Leader" });
  await expect(memberDialog).toBeVisible();
  await expect(memberDialog.getByText("Member Details")).toBeVisible();
  const endMembership = memberDialog.getByRole("button", { name: "End Rover Membership" });
  await expect(endMembership).toBeVisible();
  await endMembership.click();
  await expect(memberDialog.getByText("Rover membership ended. The member record, history and unrelated roles are preserved.")).toBeVisible();
  await expect(memberDialog.getByTestId("member-rover-membership-actions")).toHaveCount(0);

  await memberDialog.getByRole("button", { name: "Close" }).click();
  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "All Statuses" }).click();
  await expect(page.locator("[data-testid^='member-card-']").filter({ hasText: "Rovers Section Leader" }).getByText("Left")).toBeVisible();
});
