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

  test("public journey shows a compact TEST banner and About build information", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "About Us" })).toBeVisible();

    const banner = page.getByTestId("test-environment-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/TEST · synthetic data · Build [a-f0-9]{7}/i);

    const box = await banner.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(viewport!.width);
    expect(box!.height).toBeLessThanOrEqual(48);

    await expect(page.getByRole("heading", { name: "Build information" })).toBeVisible();
    await expect(page.getByText(/Build .* · Commit [a-f0-9]{7}/i)).toBeVisible();
    await expect(page.getByRole("contentinfo")).not.toContainText(/Build /i);
  });

  test("TEST banner does not obstruct public navigation", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByTestId("test-environment-banner");
    const header = page.locator("header");
    await expect(banner).toBeVisible();
    await expect(header).toBeVisible();

    const bannerBox = await banner.boundingBox();
    const headerBox = await header.boundingBox();
    expect(bannerBox).not.toBeNull();
    expect(headerBox).not.toBeNull();
    expect(bannerBox!.y + bannerBox!.height).toBeLessThanOrEqual(headerBox!.y + 1);
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
