import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
    test.skip(testInfo.project.name !== "chromium", "Event gallery coverage runs once on desktop Chromium.");
}

async function loginAdmin(page: Page) {
    await page.goto("/leader/login");
    await page.getByLabel("Email address").fill("test.webadmin@example.com");
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function expectBelowStickyHeader(page: Page, targetSelector: string) {
    await expect.poll(async () => page.evaluate((selector) => {
        const header = document.querySelector<HTMLElement>("[data-site-sticky-header]");
        const target = document.querySelector<HTMLElement>(selector);
        if (!header || !target) return -1;
        return Math.round(target.getBoundingClientRect().top - header.getBoundingClientRect().bottom);
    }, targetSelector)).toBeGreaterThanOrEqual(12);
}

test("event status tiles filter and jump to the event results", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/events");
    const statusSummary = page.getByRole("group", { name: "Event status summary" });
    await statusSummary.getByRole("button", { name: /Open/ }).click();
    const results = page.getByRole("region", { name: "Event results" });
    await expect(results).toBeFocused();
    await expect(results).toBeInViewport();
    await expect(page.getByRole("combobox", { name: "Status" })).toHaveText(/Open/);
    await expectBelowStickyHeader(page, "#event-results");
});

test("event status tiles support keyboard activation", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/events");
    const completedTile = page.getByRole("group", { name: "Event status summary" }).getByRole("button", { name: /Completed/ });
    await completedTile.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "Event results" })).toBeFocused();
    await expect(page.getByText("Completed events are retained as read-only history. Open an event to access reports, exports and its gallery.")).toBeVisible();
});

test("legacy event deep links open the full event record", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/events?event=TEST_flow_event_beavers_open");
    await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);
    await expect(page.getByTestId("event-record-TEST_flow_event_beavers_open")).toBeVisible();
    await expect(page.getByRole("heading", { name: "TEST Beavers Open Day Trip" })).toBeVisible();
});

test("leader opens the gallery from the full event record", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/events");
    await page.getByTestId("event-card-TEST_flow_event_beavers_open").click();
    await expect(page).toHaveURL(/\/leader\/events\/TEST_flow_event_beavers_open$/);
    await page.getByRole("button", { name: "Gallery", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("TEST Beavers Open Day Trip · Gallery", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Leader-only gallery. Parent access remains disabled until explicit photo-sharing consent is available.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Choose gallery photos")).toHaveAttribute("multiple", "");
    await expect(page.getByLabel("Take gallery photo")).toHaveAttribute("capture", "environment");
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).toHaveCount(0);
});

test("completed event history keeps gallery access on its record page", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/events");
    await page.getByRole("combobox", { name: "Status" }).click();
    await page.getByRole("option", { name: "Completed" }).click();
    const completedCards = page.locator('[data-testid^="event-card-"]');
    const count = await completedCards.count();
    if (count > 0) {
        await completedCards.first().click();
        await expect(page.getByRole("button", { name: "Gallery", exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: "Edit Event", exact: true })).toBeDisabled();
    }
});
