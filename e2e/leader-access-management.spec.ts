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

test.describe("leader access management", () => {
  test("admin reviews and cancels an account deactivation before any persisted change", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");
    test.skip(!seededJourneyData, "Canonical leader journey seed data is required.");

    await loginAdmin(page);
    await page.goto("/leader/access");
    await expect(page.getByRole("heading", { name: "Leader Access & Organisation" })).toBeVisible();

    const card = page.getByTestId("leader-access-TEST_uid_multi_section_leader");
    await expect(card).toContainText("Test Multi Section Leader");

    const active = card.getByRole("switch", { name: "Active" });
    await expect(active).toBeChecked();
    await active.click();
    await expect(active).not.toBeChecked();

    await card.getByRole("button", { name: "Save Leader" }).click();

    const dialog = page.getByRole("dialog", { name: "Confirm leader access changes?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Test Multi Section Leader");
    await expect(dialog).toContainText("Account access will be disabled.");
    await expect(dialog.getByRole("button", { name: "Confirm Changes" })).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(active).not.toBeChecked();

    await page.getByRole("button", { name: "Refresh" }).click();
    await expect(active).toBeChecked();
  });
});
