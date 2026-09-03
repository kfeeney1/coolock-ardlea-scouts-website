import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const seededJourneyData = process.env.E2E_LEADER_JOURNEY_SEEDED === "true";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Parent access management checks run once on desktop Chromium.");
}

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(adminEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test.describe("parent access management", () => {
  test("admin opens a parent, searches for children and gets an in-app revoke confirmation", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");

    await loginAdmin(page);
    await page.goto("/leader/parent-access");
    await expect(page.getByRole("heading", { name: "Parent Access" })).toBeVisible();

    const approvedCard = page.getByTestId(/^parent-access-/).filter({ has: page.getByText("approved", { exact: true }) }).first();
    if (await approvedCard.count()) {
      await expect(approvedCard.getByRole("button", { name: "Approve Access" })).toHaveCount(0);
      await expect(approvedCard.getByRole("button", { name: "Manage Linked Children" })).toBeVisible();

      await approvedCard.getByRole("button", { name: "Revoke Access" }).click();
      const revokeDialog = page.getByRole("dialog", { name: "Revoke parent access?" });
      await expect(revokeDialog).toBeVisible();
      await expect(revokeDialog).toContainText(/immediately clears all linked children and sections/i);
      await expect(revokeDialog).toContainText(/account and historical records are not deleted/i);
      await revokeDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(revokeDialog).toHaveCount(0);
      await expect(approvedCard.getByText("approved", { exact: true })).toBeVisible();
    }

    const manageButton = page.getByRole("button", { name: "Manage Linked Children" }).first();
    await expect(manageButton).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);

    await manageButton.click();
    const search = page.getByLabel(/Search members for/).first();
    await expect(search).toBeVisible();
    await expect(page.getByText(/full member list is no longer shown automatically/i)).toBeVisible();
    await expect(page.getByRole("checkbox")).toHaveCount(0);

    if (seededJourneyData) {
      await search.fill("Riley Nolan");
      await expect(page.getByText("Riley Nolan Beavers 01 (Beavers)", { exact: true })).toBeVisible();
      await expect(page.getByRole("checkbox")).toHaveCount(1);

      await search.fill("No Such Member 999");
      await expect(page.getByText("No member records match this search.")).toBeVisible();
      await expect(page.getByRole("checkbox")).toHaveCount(0);
    }
  });

  test("parent approval and rejection require review and cancel leaves the request pending", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password || !adminEmail || !seededJourneyData, "Configure canonical seeded E2E admin data.");

    await loginAdmin(page);
    await page.goto("/leader/parent-access");

    let pendingCard = page.getByTestId("parent-access-TEST_flow_parent_pending");
    await expect(pendingCard).toBeVisible();
    await expect(pendingCard.getByText("pending", { exact: true })).toBeVisible();
    await expect(pendingCard).toContainText("0 linked children");

    await pendingCard.getByRole("button", { name: "Manage Linked Children", exact: true }).click();
    const search = page.getByLabel("Search members for Test Pending Parent");
    await search.fill("Riley Nolan");
    const child = page.getByText("Riley Nolan Beavers 01 (Beavers)", { exact: true });
    await expect(child).toBeVisible();
    await page.getByRole("checkbox").check();

    await pendingCard.getByRole("button", { name: "Approve Access", exact: true }).click();
    const approveDialog = page.getByRole("dialog", { name: "Approve parent access?" });
    await expect(approveDialog).toBeVisible();
    await expect(approveDialog).toContainText("Test Pending Parent");
    await expect(approveDialog).toContainText("1 selected child record");
    await expect(approveDialog).toContainText("Beavers");
    await expect(approveDialog).toContainText(/grants parent-portal access/i);
    await expect(approveDialog).toContainText(/consent records.*linked/i);
    await approveDialog.getByRole("button", { name: "Back to review", exact: true }).click();
    await expect(approveDialog).toHaveCount(0);
    await expect(pendingCard.getByText("pending", { exact: true })).toBeVisible();

    await pendingCard.getByRole("button", { name: "Reject Access", exact: true }).click();
    const rejectDialog = page.getByRole("dialog", { name: "Reject parent access?" });
    await expect(rejectDialog).toBeVisible();
    await expect(rejectDialog).toContainText("Test Pending Parent");
    await expect(rejectDialog).toContainText(/marked Rejected/i);
    await expect(rejectDialog).toContainText(/No child or section access will be granted/i);
    await expect(rejectDialog).toContainText(/does not delete the account/i);
    await rejectDialog.getByRole("button", { name: "Back to review", exact: true }).click();
    await expect(rejectDialog).toHaveCount(0);

    await page.reload();
    pendingCard = page.getByTestId("parent-access-TEST_flow_parent_pending");
    await expect(pendingCard).toBeVisible();
    await expect(pendingCard.getByText("pending", { exact: true })).toBeVisible();
    await expect(pendingCard).toContainText("0 linked children");
  });
});
