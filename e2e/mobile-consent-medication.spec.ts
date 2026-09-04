import { expect, test, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function mobileOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile consent layout runs on the Pixel 7 project only.");
}

test("medication record stacks labels and values inside the mobile viewport", async ({ page }, testInfo) => {
  mobileOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

  await page.goto("/leader/consents/TEST_flow_consent_youth_medication");
  const panel = page.getByTestId("medication-management-panel");
  const firstRow = page.getByTestId("medication-management-row").first();
  await expect(panel).toBeVisible();
  await expect(page.getByTestId("medication-management-row")).toHaveCount(20);

  const [panelBox, labelBox, valueBox] = await Promise.all([
    panel.boundingBox(),
    firstRow.locator("td").nth(0).boundingBox(),
    firstRow.locator("td").nth(1).boundingBox()
  ]);
  expect(panelBox).not.toBeNull();
  expect(labelBox).not.toBeNull();
  expect(valueBox).not.toBeNull();
  expect(panelBox!.x).toBeGreaterThanOrEqual(0);
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(412);
  expect(valueBox!.y).toBeGreaterThanOrEqual(labelBox!.y + labelBox!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(412);
});
