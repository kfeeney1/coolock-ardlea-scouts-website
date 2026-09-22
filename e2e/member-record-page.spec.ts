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
  await page.goto("/leader/members/TEST_member_scout_01");

  const familyPanel = page.getByTestId("member-family-management");
  await expect(familyPanel).toBeVisible();

  // Build the relationship through the supported UI using canonical seeded members.
  // This keeps the regression independent of invented fixture IDs and also proves
  // the resulting family link is immediately navigable.
  await familyPanel.getByLabel("Search existing members").fill("Cubs 01");
  const candidate = familyPanel.getByText(/Cubs 01/).first();
  await expect(candidate).toBeVisible();
  await candidate.locator("xpath=ancestor::*[.//button[normalize-space()='Select' or normalize-space()='Selected']][1]").getByRole("button", { name: "Select" }).click();
  await familyPanel.getByRole("button", { name: "Link selected siblings" }).click();

  const sibling = familyPanel.locator('a[href="/leader/members/TEST_member_cub_01"]');
  await expect(sibling).toBeVisible();
  await sibling.click();

  await expect(page).toHaveURL(/\/leader\/members\/TEST_member_cub_01$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/leader\/members\/TEST_member_scout_01$/);
  await expect(page.getByTestId("member-family-management")).toBeVisible();
});


test("SW-134/135 medical indicators reflow and open the stable protected consent record", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Medical indicator regression runs on desktop and Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAdmin(page);
  await page.goto("/leader/members/TEST_member_beaver_01");

  const indicators = page.getByRole("heading", { name: "Consent & Medical Indicators" }).locator("xpath=following-sibling::*[1]");
  await expect(indicators).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));

  const medicalLink = page.getByRole("link", { name: /Open consent and medical details/ }).first();
  await expect(medicalLink).toBeVisible();
  const href = await medicalLink.getAttribute("href");
  expect(href).toMatch(/^\/leader\/consents\/.+/);
  await medicalLink.focus();
  await expect(medicalLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&")}$`));
  await expect(page.getByRole("heading", { name: "Important medical information" })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/leader\/members\/TEST_member_beaver_01$/);
  await expect(page.getByRole("heading", { name: "Consent & Medical Indicators" })).toBeVisible();
});
