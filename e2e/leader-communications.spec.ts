import { expect, test, type TestInfo } from "@playwright/test";

type Credentials = { email: string; password: string };

function credentials(): Credentials | null {
    const email = process.env.E2E_LEADER_EMAIL?.trim();
    const password = process.env.E2E_LEADER_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
    return email && password ? { email, password } : null;
}

function desktopOnly(testInfo: TestInfo) {
    test.skip(testInfo.project.name !== "chromium", "Authenticated communication checks run once on desktop Chromium.");
}

async function loginLeader(page: import("@playwright/test").Page, account: Credentials) {
    await page.goto("/leader/login");
    await page.getByLabel("Email address").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("communications route rejects unauthenticated users", async ({ page }) => {
    await page.goto("/leader/communications");
    await expect(page).toHaveURL(/\/leader\/login$/);
});

test("ordinary leader can open section-scoped parent communications", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const account = credentials();
    test.skip(!account, "Configure the seeded E2E leader account to run this check.");
    await loginLeader(page, account!);

    await expect(page.getByRole("link", { name: "Parent Communications" })).toBeVisible();
    await page.getByRole("link", { name: "Parent Communications" }).click();
    await expect(page).toHaveURL(/\/leader\/communications$/);
    await expect(page.getByRole("heading", { name: "Parent Communications" })).toBeVisible();
    await expect(page.getByText(/Scope:/)).toContainText("Scouts");
    await expect(page.getByLabel("Subject")).toBeVisible();
    await expect(page.getByLabel("Message")).toBeVisible();
    await expect(page.getByRole("button", { name: /Send to 0 recipients/ })).toBeDisabled();
});

test("leader dashboard navigation collapses into an expandable mobile menu", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const account = credentials();
    test.skip(!account, "Configure the seeded E2E leader account to run this check.");
    await page.setViewportSize({ width: 375, height: 812 });
    await loginLeader(page, account!);

    const menuButton = page.getByRole("button", { name: /Leader Menu/ });
    await expect(menuButton).toBeVisible();
    await expect(page.getByRole("link", { name: "Parent Communications" })).toHaveCount(0);

    await menuButton.click();
    const communicationsLink = page.getByRole("link", { name: "Parent Communications" });
    await expect(communicationsLink).toBeVisible();
    await communicationsLink.click();

    await expect(page).toHaveURL(/\/leader\/communications$/);
    await expect(page.getByRole("heading", { name: "Parent Communications" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Parent Communications" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Menu · Parent Communications/ })).toBeVisible();
});
