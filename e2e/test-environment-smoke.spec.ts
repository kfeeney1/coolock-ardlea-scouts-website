import { expect, test } from "@playwright/test";

const testPassword = process.env.E2E_TEST_USER_PASSWORD;
const stableTestSmoke = process.env.E2E_STABLE_ENVIRONMENT_SMOKE === "true";

async function signIn(page: import("@playwright/test").Page, path: string, email: string) {
  await page.goto(path);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(testPassword!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

test.describe("stable TEST environment smoke", () => {
  test.skip(!stableTestSmoke, "Stable TEST smoke runs only after a TEST deployment.");
  test.skip(!testPassword, "Stable TEST smoke requires the synthetic TEST password.");

  test("public journey renders the deployed public site", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "About Us" })).toBeVisible();
    await expect(page.getByText(/test environment/i)).toBeVisible();
  });

  test("leader journey authenticates a synthetic section leader read-only", async ({ page }) => {
    await signIn(page, "/leader/login", "test.scout.section.leader@example.com");
    await expect(page).toHaveURL(/\/leader(?:\/)?$/);
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  });

  test("parent journey authenticates an approved synthetic parent read-only", async ({ page }) => {
    await signIn(page, "/parent", "test.cub.parent1@example.com");
    await expect(page.getByRole("heading", { name: "Parent Portal" })).toBeVisible();
    await expect(page.getByText(/Your account is approved and linked to/i)).toBeVisible();
  });
});
