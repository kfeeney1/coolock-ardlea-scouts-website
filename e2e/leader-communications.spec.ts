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

function mobileOnly(testInfo: TestInfo) {
    test.skip(testInfo.project.name !== "mobile-chromium", "Mobile navigation check runs on the Pixel 7 project.");
}

async function loginLeader(page: import("@playwright/test").Page, account: Credentials) {
    await page.goto("/leader/login");
    await page.getByLabel("Email address").fill(account.email);
    await page.getByLabel("Password").fill(account.password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function openLeaderMenu(page: import("@playwright/test").Page) {
    const menuButton = page.getByRole("button", { name: /Leader Menu/ });
    await expect(menuButton).toBeVisible();
    await expect(page.getByRole("link", { name: "Parent Communications" })).toHaveCount(0);
    await menuButton.click();

    if (page.viewportSize() && page.viewportSize()!.width < 600) {
        const peopleGroup = page.getByRole("navigation", { name: "Leader navigation" }).getByRole("button", { name: "People & Parents" });
        await peopleGroup.click();
    }

    await expect(page.getByRole("link", { name: "Parent Communications" })).toBeVisible();
}

test("communications route rejects unauthenticated users", async ({ page }) => {
    await page.goto("/leader/communications");
    await expect(page).toHaveURL(/\/leader\/login$/);
});

test("ordinary leader composes first, then chooses recipients, while WhatsApp stays on step one", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const account = credentials();
    test.skip(!account, "Configure the seeded E2E leader account to run this check.");
    await loginLeader(page, account!);
    await openLeaderMenu(page);

    await page.getByRole("link", { name: "Parent Communications" }).click();
    await expect(page).toHaveURL(/\/leader\/communications$/);
    await expect(page.getByRole("heading", { name: "Parent Communications" })).toBeVisible();
    await expect(page.getByText(/Scope:/)).toContainText("Scouts");

    const composer = page.getByTestId("communication-composer");
    const recipients = page.getByTestId("communication-recipients");
    await expect(composer).toBeVisible();
    await expect(recipients).toHaveCount(0);

    await page.getByLabel("Subject").fill("TEST Scouts reminder");
    await page.getByLabel("Message").fill("TEST Bring your necker and water bottle.");
    const whatsapp = page.getByRole("link", { name: "Share via WhatsApp" });
    await expect(whatsapp).toHaveAttribute("href", "https://wa.me/?text=TEST%20Scouts%20reminder%0A%0ATEST%20Bring%20your%20necker%20and%20water%20bottle.");
    await expect(whatsapp).toHaveAttribute("target", "_blank");

    await page.getByRole("button", { name: "Continue to recipients" }).click();
    await expect(composer).toHaveCount(0);
    await expect(recipients).toBeVisible();
    await expect(recipients).toContainText("TEST Scouts reminder");
    await expect(recipients).toContainText("TEST Bring your necker and water bottle.");
    await expect(page.getByRole("button", { name: /Send Email to 0 recipients/ })).toBeDisabled();

    await page.getByRole("button", { name: "Back to message" }).click();
    await expect(composer).toBeVisible();
    await expect(page.getByLabel("Subject")).toHaveValue("TEST Scouts reminder");
    await expect(page.getByLabel("Message")).toHaveValue("TEST Bring your necker and water bottle.");
    await expect(page.getByRole("link", { name: "Parent Communications" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Menu · Parent Communications/ })).toBeVisible();
});

test("leader dashboard navigation uses an expandable desktop menu", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const account = credentials();
    test.skip(!account, "Configure the seeded E2E leader account to run this check.");
    await loginLeader(page, account!);

    await openLeaderMenu(page);
    await page.getByRole("button", { name: "Hide Leader Menu" }).click();
    await expect(page.getByRole("link", { name: "Parent Communications" })).toHaveCount(0);
});

test("leader dashboard navigation uses the same expandable menu on Pixel 7", async ({ page }, testInfo) => {
    mobileOnly(testInfo);
    const account = credentials();
    test.skip(!account, "Configure the seeded E2E leader account to run this check.");
    await loginLeader(page, account!);

    await openLeaderMenu(page);
    await page.getByRole("link", { name: "Parent Communications" }).click();

    await expect(page).toHaveURL(/\/leader\/communications$/);
    await expect(page.getByRole("heading", { name: "Parent Communications" })).toBeVisible();
    await expect(page.getByTestId("communication-composer")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to recipients" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Parent Communications" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Menu · Parent Communications/ })).toBeVisible();
});