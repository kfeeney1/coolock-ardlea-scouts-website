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
  await expect(page.getByRole("button", { name: "Request Leader Access" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Request Leader Access" })).toHaveCount(0);
}

test.describe("approved parent journey", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Authenticated parent journey runs once on desktop Chromium.");
    test.skip(!password || !parentEmail, "Configure canonical E2E parent credentials.");
  });

  test("parent sees searchable consent tiles and refreshes tasks after completing a missing linked consent form", async ({ page }) => {
    await loginParent(page);

    const summary = page.getByTestId("parent-things-to-do");
    const medicalAttentionCount = summary.getByTestId("parent-medical-attention-count");
    await expect(summary.getByRole("heading", { name: "Things to do" })).toBeVisible();
    await expect(summary.getByText("Event consent", { exact: true })).toBeVisible();
    await expect(summary.getByText("Medical & consent", { exact: true })).toBeVisible();
    await expect(summary.getByText("Upcoming events", { exact: true })).toBeVisible();
    await expect(medicalAttentionCount).toHaveText("1");

    await expect(page.getByRole("heading", { name: "Consent & Medical Forms" })).toBeVisible();
    await expect(page.getByText(firstMember, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(secondMember, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Consent linked", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Consent not started", { exact: true }).first()).toBeVisible();

    const search = page.getByTestId("parent-consent-search");
    await search.fill(secondMember);
    await expect(page.getByTestId("parent-consent-tile-TEST_member_beaver_02")).toBeVisible();
    await expect(page.getByTestId("parent-consent-tile-TEST_member_beaver_01")).toHaveCount(0);

    await page
      .getByTestId("parent-consent-tile-TEST_member_beaver_02")
      .getByRole("button", { name: `Complete consent for ${secondMember}` })
      .click();
    const save = page.getByRole("button", { name: "Save Consent & Medical Details" });
    await expect(save).toBeVisible();
    await save.click();
    await expect(page.getByText("Consent and medical details updated successfully.")).toBeVisible();
    await expect(medicalAttentionCount).toHaveText("0");
  });

  test("parent event consent appears for the canonical linked Beavers event", async ({ page }) => {
    await loginParent(page);

    const nextAction = page.getByTestId("parent-next-action");
    await expect(nextAction).toContainText("Next action");
    await expect(nextAction).toContainText("TEST Beavers Open Day Trip");
    await expect(nextAction.getByRole("button", { name: "Review consent" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Upcoming Events & Event Consent" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "TEST Beavers Open Day Trip" })).toBeVisible();
    const consentLink = page.getByRole("link", { name: "Complete Event Consent" });
    const consentHref = await consentLink.getAttribute("href");
    expect(consentHref).toBeTruthy();
    await consentLink.click();
    await expect(page.getByRole("heading", { name: "Event Consent" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "TEST Beavers Open Day Trip", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Back to Parent Portal" }).click();
    await expect(page.getByRole("heading", { name: "Things to do" })).toBeVisible();

    await page.goto(consentHref!);
    await expect(page.getByRole("heading", { name: "Event Consent" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "TEST Beavers Open Day Trip", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Parent Portal" })).toHaveCount(0);
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

test("approved parent can sign out globally and must authenticate again", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Parent logout regression runs on desktop and Pixel 7 Chromium.");
  test.skip(!password || !parentEmail, "Configure canonical E2E parent credentials.");

  await loginParent(page);
  const globalSignOut = page.getByRole("button", { name: "Sign Out", exact: true }).first();
  await expect(globalSignOut).toBeVisible();
  await globalSignOut.click();

  await expect(page).toHaveURL(/\/$/);
  await page.goto("/parent");
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();

  await page.getByLabel("Email").fill(parentEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText(/Your account is approved and linked to 2 member records/i)).toBeVisible();
});
