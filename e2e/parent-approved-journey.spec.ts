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

  test("parent sees searchable consent tiles and refreshes tasks after saving a linked consent form", async ({ page, request }) => {
    await loginParent(page);

    const summary = page.getByTestId("parent-things-to-do");
    const medicalAttentionCount = summary.getByTestId("parent-medical-attention-count");
    await expect(summary.getByRole("heading", { name: "Things to do" })).toBeVisible();
    await expect(summary.getByText("Event consent", { exact: true })).toBeVisible();
    await expect(summary.getByText("Medical & consent", { exact: true })).toBeVisible();
    await expect(summary.getByText("Upcoming events", { exact: true })).toBeVisible();
    await expect(medicalAttentionCount).toHaveText("2");

    await expect(page.getByRole("heading", { name: "Consent & Medical Forms" })).toBeVisible();
    await expect(page.getByText(firstMember, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(secondMember, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Consent linked", { exact: true }).first()).toBeVisible();

    const search = page.getByTestId("parent-consent-search");
    await search.fill(firstMember);
    await expect(page.getByText(firstMember, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(secondMember, { exact: true })).toHaveCount(0);

    await page
      .getByTestId("parent-consent-tile-TEST_member_beaver_01")
      .getByRole("button", { name: "Review Consent" })
      .click();
    const save = page.getByRole("button", { name: "Save Consent & Medical Details" });
    await expect(save).toBeVisible();
    try {
      await save.click();
      await expect(medicalAttentionCount).toHaveText("1");
    } finally {
      const restored = await request.patch("http://127.0.0.1:8080/v1/projects/coolock-ardlea-scouts/databases/(default)/documents/consentApplications/TEST_flow_consent_youth_medication?updateMask.fieldPaths=updatedByParent", {
        data: { fields: { updatedByParent: { booleanValue: false } } }
      });
      expect(restored.ok()).toBeTruthy();
    }
  });

  test("parent event consent appears for the canonical linked Beavers event", async ({ page }) => {
    await loginParent(page);

    const nextAction = page.getByTestId("parent-next-action");
    await expect(nextAction).toContainText("Next action");
    await expect(nextAction).toContainText("TEST Beavers Open Day Trip");
    await expect(nextAction.getByRole("button", { name: "Review consent" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Upcoming Events & Event Consent" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "TEST Beavers Open Day Trip" })).toBeVisible();
    await page.getByRole("link", { name: "Complete Event Consent" }).click();
    await expect(page.getByRole("heading", { name: "Event Consent" })).toBeVisible();
    await expect(page.getByText("TEST Beavers Open Day Trip", { exact: true })).toBeVisible();
  });

  test("parent gallery area fails closed when no gallery access is projected", async ({ page }) => {
    await loginParent(page);

    await expect(page.getByRole("heading", { name: "Event Galleries" })).toBeVisible();
    await expect(page.getByTestId("parent-event-gallery-empty")).toBeVisible();
    await expect(page.getByTestId("parent-event-galleries")).toHaveCount(0);
    await expect(page.getByTestId("parent-event-gallery-error")).toHaveCount(0);
    await expect(page.getByTestId("parent-event-gallery-retry")).toHaveCount(0);
  });
});
