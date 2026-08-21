import { expect, test } from "@playwright/test";

const parentEmail = "test.parent.only@example.com";
const password = process.env.E2E_TEST_USER_PASSWORD;

async function loginParent(page: import("@playwright/test").Page) {
  await page.goto("/parent");
  await page.getByLabel("Email").fill(parentEmail);
  await page.getByLabel("Password").fill(password || "");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText(/Your account is approved and linked to 2 member records/i)).toBeVisible();
}

test.describe("approved parent journey", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Authenticated parent journey runs once on desktop Chromium.");
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD to run the approved parent journey.");
  });

  test("parent sees linked children and editable consent information", async ({ page }) => {
    await loginParent(page);

    await expect(page.getByRole("heading", { name: "Consent & Medical Forms" })).toBeVisible();
    await expect(page.getByText("Emma Byrne", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Jack Byrne", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Consent linked", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Save Consent & Medical Details" })).toBeVisible();
  });

  test("parent event consent appears after linked-section rules are deployed", async ({ page }) => {
    test.skip(process.env.E2E_PARENT_EVENT_CONSENT_ENABLED !== "true", "Enable after deploying the parent linked-section Firestore rules and reseeding test data.");
    await loginParent(page);

    await expect(page.getByRole("heading", { name: "Upcoming Events & Event Consent" })).toBeVisible();
    await expect(page.getByText("TEST Cub Weekend Camp", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Complete Event Consent" }).click();
    await expect(page.getByRole("heading", { name: "Event Consent" })).toBeVisible();
    await expect(page.getByText("TEST Cub Weekend Camp", { exact: true })).toBeVisible();
  });
});
