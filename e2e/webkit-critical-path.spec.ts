import { expect, test } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

test.describe("WebKit critical path", () => {
  test("public site and leader navigation work on iPhone WebKit", async ({ page }) => {
    test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();

    await page.goto("/leader/login");
    await expect(page.getByRole("heading", { name: "Leader Login" })).toBeVisible();
    await page.getByLabel("Email address").fill(leaderEmail!);
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign In" }).click();

    // WebKit can take a little longer to complete Firebase auth/profile hydration.
    // Wait for the authenticated route and dashboard rather than relying on the
    // default 5 s assertion window, while still failing if sign-in does not finish.
    await expect(page).toHaveURL(/\/leader\/?$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible({ timeout: 15_000 });

    const menuButton = page.getByRole("button", { name: /(Leader Menu|Menu ·)/ });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await page.getByRole("navigation", { name: "Leader navigation" }).getByRole("button", { name: "Programme" }).click();

    const weeklyMeetingsLink = page.getByRole("link", { name: "Weekly Meetings", exact: true });
    await expect(weeklyMeetingsLink).toBeVisible();
    await weeklyMeetingsLink.click();

    await expect(page).toHaveURL(/\/leader\/weekly$/);
    await expect(page.getByRole("heading", { name: "Weekly Meetings" })).toBeVisible();
  });
});
