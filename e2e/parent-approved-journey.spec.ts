import { expect, test } from "@playwright/test";

const parentEmail = process.env.E2E_PARENT_EMAIL;
const password = process.env.E2E_TEST_USER_PASSWORD;
const firstMember = "Riley Nolan Beavers 01";
const secondMember = "Morgan Kavanagh Beavers 02";

async function loginParent(page: import("@playwright/test").Page) {
  await page.goto("/parent");
  await page.getByLabel("Email").fill(parentEmail!);
  await page.getByLabel("Password").fill(password || "");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText(/Your account is approved and linked to 2 member records/i)).toBeVisible();
}

test.describe("approved parent journey", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Authenticated parent journey runs once on desktop Chromium.");
    test.skip(!password || !parentEmail, "Configure canonical E2E parent credentials.");
  });

  test("parent sees searchable consent tiles and can open a linked consent form", async ({ page }) => {
    await loginParent(page);

    const summary = page.getByTestId("parent-things-to-do");
    await expect(summary.getByRole("heading", { name: "Things to do" })).toBeVisible();
    await expect(summary.getByText("Event consent", { exact: true })).toBeVisible();
    await expect(summary.getByText("Medical & consent", { exact: true })).toBeVisible();
    await expect(summary.getByText("Upcoming events", { exact: true })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Consent & Medical Forms" })).toBeVisible();
    await expect(page.getByText(firstMember, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(secondMember, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Consent linked", { exact: true }).first()).toBeVisible();

    const search = page.getByTestId("parent-consent-search");
    await search.fill(firstMember);
    await expect(page.getByText(firstMember, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(secondMember, { exact: true })).toHaveCount(0);

    await page.getByRole("button", { name: "Review Consent" }).click();
    await expect(page.getByRole("button", { name: "Save Consent & Medical Details" })).toBeVisible();
  });

  test("parent event consent appears for the canonical linked Beavers event", async ({ page }) => {
    test.skip(process.env.E2E_PARENT_EVENT_CONSENT_ENABLED !== "true", "Enable when parent linked-section event-consent coverage is required.");
    await loginParent(page);

    const nextAction = page.getByTestId("parent-next-action");
    await expect(nextAction).toContainText("Next action");
    await expect(nextAction).toContainText("TEST Beavers Open Day Trip");
    await expect(nextAction.getByRole("button", { name: "Review consent" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Upcoming Events & Event Consent" })).toBeVisible();
    await expect(page.getByText("TEST Beavers Open Day Trip", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Complete Event Consent" }).click();
    await expect(page.getByRole("heading", { name: "Event Consent" })).toBeVisible();
    await expect(page.getByText("TEST Beavers Open Day Trip", { exact: true })).toBeVisible();
  });
});
