import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Member record navigation runs once on desktop Chromium.");
}

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill("test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("clicking anywhere on a member tile opens a full member record with history", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/members");

  const card = page.locator('[data-testid^="member-card-"]').first();
  await expect(card).toBeVisible();
  const memberName = (await card.getByRole("heading").first().textContent())?.trim() || "";
  await card.click({ position: { x: 20, y: 20 } });

  await expect(page).toHaveURL(/\/leader\/members\/[^/]+$/);
  await expect(page.getByRole("heading", { name: memberName, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Member Details" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Consent & Medical Indicators" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Member History" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("legacy Member History route folds back into Member Management", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/member-history");
  await expect(page).toHaveURL(/\/leader\/members$/);
  await expect(page.getByRole("heading", { name: "Member Management" })).toBeVisible();
});


test("SW-116 linked family member opens the canonical member record and Back returns to the family view", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/members/TEST_family_two_member_01");

  const familyPanel = page.getByTestId("member-family-management");
  await expect(familyPanel).toBeVisible();
  const sibling = familyPanel.getByRole("link", { name: "Open member record for TEST 2-Sibling Family Member 2" });
  await expect(sibling).toBeVisible();
  await sibling.click();

  await expect(page).toHaveURL(/\/leader\/members\/TEST_family_two_member_02$/);
  await expect(page.getByRole("heading", { name: "TEST 2-Sibling Family Member 2", level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/leader\/members\/TEST_family_two_member_01$/);
  await expect(page.getByTestId("member-family-management")).toBeVisible();
});
