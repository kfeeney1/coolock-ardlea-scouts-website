import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
    test.skip(testInfo.project.name !== "chromium", "Member Management targeting runs once on desktop Chromium.");
}

async function loginAdmin(page: Page) {
    await page.goto("/leader/login");
    await page.getByLabel("Email address").fill("test.webadmin@example.com");
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("member status tiles filter and jump to member results", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/members");

    const summary = page.getByRole("group", { name: "Member status summary" });
    const inactiveTile = summary.getByRole("button", { name: /Inactive/ });
    await inactiveTile.click();

    const results = page.getByRole("region", { name: "Member results" });
    await expect(results).toBeFocused();
    await expect(results).toBeInViewport();
    await expect(inactiveTile).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("combobox", { name: "Status" })).toHaveText(/Inactive/);

    const header = page.locator("[data-site-sticky-header]");
    await expect(header).toBeVisible();
    const [headerBox, resultsBox] = await Promise.all([header.boundingBox(), results.boundingBox()]);
    expect(headerBox).not.toBeNull();
    expect(resultsBox).not.toBeNull();
    expect(resultsBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height);
});

test("member status tiles support keyboard activation", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/members");

    const summary = page.getByRole("group", { name: "Member status summary" });
    const totalTile = summary.getByRole("button", { name: /Total/ });
    await totalTile.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("region", { name: "Member results" })).toBeFocused();
    await expect(totalTile).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("combobox", { name: "Status" })).toHaveText(/All Statuses/);
});
