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
  test("admin opens a parent then searches for child members instead of rendering the full list", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");

    await loginAdmin(page);
    await page.goto("/leader/parent-access");
    await expect(page.getByRole("heading", { name: "Parent Access" })).toBeVisible();

    const approvedCard = page.getByTestId(/^parent-access-/).filter({ has: page.getByText("approved", { exact: true }) }).first();
    if (await approvedCard.count()) {
      await expect(approvedCard.getByRole("button", { name: "Approve Access" })).toHaveCount(0);
      await expect(approvedCard.getByRole("button", { name: "Manage Linked Children" })).toBeVisible();
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
});
