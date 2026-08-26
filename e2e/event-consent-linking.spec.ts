import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;

function desktopOnly(testInfo: TestInfo) {
    test.skip(testInfo.project.name !== "chromium", "Event consent linking runs once on desktop Chromium.");
}

async function loginAdmin(page: Page) {
    await page.goto("/leader/login");
    await page.getByLabel("Email address").fill("test.webadmin@example.com");
    await page.getByLabel("Password").fill(password!);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("consent-required event links directly to parent event consent management", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAdmin(page);
    await page.goto("/leader/events");

    const consentEvent = page.getByTestId("event-card-TEST_flow_event_beavers_open");
    await expect(consentEvent.getByText("TEST Beavers Open Day Trip", { exact: true })).toBeVisible();
    const manageConsent = consentEvent.getByRole("link", { name: "Manage Consent", exact: true });
    await expect(manageConsent).toHaveAttribute("href", "/leader/event-consent?eventId=TEST_flow_event_beavers_open");

    const nonConsentEvent = page.getByTestId("event-card-TEST_flow_event_scouts_closed");
    await expect(nonConsentEvent.getByText("TEST Scouts Closed Hike", { exact: true })).toBeVisible();
    await expect(nonConsentEvent.getByRole("link", { name: "Manage Consent", exact: true })).toHaveCount(0);

    await manageConsent.click();
    await expect(page).toHaveURL(/\/leader\/event-consent\?eventId=TEST_flow_event_beavers_open$/);
    await expect(page.getByRole("heading", { name: "Parent Event Consent" })).toBeVisible();
    await expect(page.getByText("TEST Beavers Open Day Trip", { exact: true })).toBeVisible();
});
