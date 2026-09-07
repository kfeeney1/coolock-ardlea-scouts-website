import { expect, test, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const seededJourneyData = process.env.E2E_LEADER_JOURNEY_SEEDED === "true";
const firstMemberId = "TEST_member_beaver_01";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Badgework skill-filter regression runs once on desktop Chromium.");
}

test.describe("Badgework Adventure Skill filter", () => {
  test.beforeEach(({}, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");
    test.skip(!seededJourneyData, "Run against the canonical deterministic E2E seed.");
  });

  test("shows only the selected Adventure Skill tile and restores all tiles when cleared", async ({ page }) => {
    await page.goto("/leader/login");
    await page.getByLabel("Email address").fill(adminEmail!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

    await page.goto("/leader/badgework");
    await expect(page.getByRole("heading", { name: "Badgework Overview" })).toBeVisible();

    const memberCard = page.getByTestId(`badgework-overview-member-${firstMemberId}`);
    await expect(memberCard).toBeVisible();
    await expect(memberCard.getByTestId("badgework-skill-tile-camping")).toBeVisible();
    await expect(memberCard.getByTestId("badgework-skill-tile-swimming")).toBeVisible();

    await page.getByRole("combobox", { name: "Adventure Skill" }).click();
    await page.getByRole("option", { name: "Camping" }).click();

    await expect(memberCard.getByTestId("badgework-skill-tile-camping")).toBeVisible();
    await expect(memberCard.locator('[data-testid^="badgework-skill-tile-"]')).toHaveCount(1);
    await expect(memberCard.getByTestId("badgework-skill-tile-swimming")).toHaveCount(0);

    await page.getByRole("button", { name: "Clear all filters" }).click();
    await expect(memberCard.getByTestId("badgework-skill-tile-swimming")).toBeVisible();
  });
});
