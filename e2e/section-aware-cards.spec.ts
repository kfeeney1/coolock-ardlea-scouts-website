import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const seededJourneyData = process.env.E2E_LEADER_JOURNEY_SEEDED === "true";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Section-aware card identity runs once on desktop Chromium.");
}

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(adminEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("member, child and leader cards keep a textual section identity alongside the section accent", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");
  test.skip(!seededJourneyData, "Run against the canonical deterministic E2E seed.");

  await loginAdmin(page);

  await page.goto("/leader/members");
  const memberCard = page.getByTestId("member-card-TEST_member_beaver_01");
  await expect(memberCard).toBeVisible();
  await expect(memberCard).toHaveAttribute("data-section", "Beavers");
  await expect(memberCard.locator('[data-section-identity="Beavers"]')).toContainText("Beavers");
  await expect(memberCard.getByText("Active", { exact: true })).toBeVisible();

  await page.goto("/leader/badgework");
  const childCard = page.getByTestId("badgework-overview-member-TEST_member_beaver_01");
  await expect(childCard).toBeVisible();
  await expect(childCard).toHaveAttribute("data-section", "Beavers");
  await expect(childCard.getByTestId("section-swatch-beavers")).toBeVisible();
  await expect(childCard).toContainText("Beavers");

  await page.goto("/leader/access");
  const leaderCard = page.getByTestId("leader-access-TEST_uid_multi_section_leader");
  await expect(leaderCard).toBeVisible();
  const leaderSection = await leaderCard.getAttribute("data-section");
  expect(leaderSection).toBeTruthy();
  await expect(leaderCard.getByText(leaderSection!, { exact: true }).first()).toBeVisible();
  await expect(leaderCard.getByText("leader", { exact: true })).toBeVisible();
});
