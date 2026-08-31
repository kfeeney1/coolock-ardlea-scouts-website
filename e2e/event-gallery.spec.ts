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

test("leader can open a mobile-ready gallery from an event card", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/events");

    const eventCard = page.getByTestId("event-card-TEST_flow_event_beavers_open");
    await expect(eventCard.getByText("TEST Beavers Open Day Trip", { exact: true })).toBeVisible();
    await eventCard.getByRole("button", { name: "Gallery", exact: true }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("TEST Beavers Open Day Trip · Gallery", { exact: true })).toBeVisible();
    await expect(dialog.getByText("Leader-only gallery. Parent access remains disabled until explicit photo-sharing consent is available.", { exact: true })).toBeVisible();

    const galleryInput = page.getByLabel("Choose gallery photos");
    await expect(galleryInput).toHaveAttribute("multiple", "");
    await expect(galleryInput).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");

    const cameraInput = page.getByLabel("Take gallery photo");
    await expect(cameraInput).toHaveAttribute("capture", "environment");
    await expect(cameraInput).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");

    await dialog.getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog).toHaveCount(0);
});

test("completed event history keeps gallery access", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/events");

    await page.getByLabel("Status").click();
    await page.getByRole("option", { name: "Completed" }).click();
    await expect(page.getByText("Completed events are retained as read-only history. Reports, CSV exports and event galleries remain available.")).toBeVisible();

    const completedCards = page.locator('[data-testid^="event-card-"]');
    const count = await completedCards.count();
    if (count > 0) await expect(completedCards.first().getByRole("button", { name: "Gallery", exact: true })).toBeVisible();
});
