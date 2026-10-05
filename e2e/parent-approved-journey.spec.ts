import { expect, test } from "@playwright/test";

const parentEmail = process.env.E2E_PARENT_EMAIL;
const password = process.env.E2E_TEST_USER_PASSWORD;
const firstMember = "Riley Nolan Beavers 01";
const secondMember = "Morgan Kavanagh Beavers 02";

async function choose(page: import("@playwright/test").Page, field: string, answer: "Yes" | "No") {
  const fieldControl = page.getByTestId(`parent-consent-select-${field}`);
  const radio = fieldControl.getByRole("radio", { name: answer, exact: true });
  await expect(radio).toBeVisible();
  await radio.check();
  await expect(radio).toBeChecked();
}

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
    const parentConsentSaveErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().includes("Unable to update parent consent:")) parentConsentSaveErrors.push(message.text());
    });

    const childSelect = page.getByRole("combobox", { name: "Viewing information for" });
    await expect(childSelect).toBeVisible();
    const firstChildHref = await page.getByRole("navigation", { name: "Parent Portal sections" }).getByRole("link", { name: "Badgework" }).getAttribute("href");
    const firstChildId = new URL(firstChildHref!, "http://localhost").searchParams.get("child");
    expect(firstChildId).toBeTruthy();
    await expect(page).toHaveURL(new RegExp(`child=${firstChildId}`));
    await childSelect.click();
    const secondChildOption = page.getByRole("option", { name: /Morgan Kavanagh/ });
    const secondChildId = await secondChildOption.getAttribute("data-value");
    expect(secondChildId).toBeTruthy();
    await secondChildOption.click();
    await expect(page.getByRole("combobox", { name: "Viewing information for" })).toContainText("Morgan Kavanagh");
    await expect(page).toHaveURL(new RegExp(`child=${secondChildId}`));

    const summary = page.getByTestId("parent-things-to-do");
    const medicalAttentionCount = summary.getByTestId("parent-medical-attention-count");
    await expect(summary.getByRole("heading", { name: "Things to do" })).toBeVisible();
    await expect(summary.getByText("Event consent", { exact: true })).toBeVisible();
    await expect(summary.getByText("Medical & consent", { exact: true })).toBeVisible();
    await expect(summary.getByText("Upcoming events", { exact: true })).toBeVisible();
    await expect(medicalAttentionCount).toHaveText("1");

    await expect(page.getByRole("heading", { name: "Consent & Medical Forms" })).toBeVisible();
    await expect(page.getByText(firstMember, { exact: true })).toHaveCount(0);
    await expect(page.getByText(secondMember, { exact: true }).first()).toBeVisible();
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
    const expectedToday = await page.evaluate(() => {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    });
    await expect(page.getByLabel("Consent from")).toHaveValue(expectedToday);
    await expect(page.getByLabel("Consent to")).toHaveValue(`${Number(expectedToday.slice(0, 4)) + 1}-08-31`);
    await expect(page.getByLabel("Parent / guardian 1 mobile")).toHaveAttribute("type", "tel");
    await expect(page.getByLabel("Parent / guardian 2 mobile")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await save.click();
    await expect(page.getByText(/required|Select Yes or No/i).first()).toBeVisible();
    await expect(page.getByLabel("GP name")).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Parent / guardian 1", { exact: true })).toHaveAttribute("aria-invalid", "true");
    await expect(page.getByLabel("Parent / guardian 1 mobile")).toHaveAttribute("aria-invalid", "true");

    await page.getByLabel("Consent from").fill("2026-09-01");
    await page.getByLabel("Consent to").fill("2027-07-31");
    for (const label of ["photoConsent", "waterActivities", "canSwim", "seriousIllness", "regularMeds", "medAllergies", "allergies", "dietaryReqs"]) await choose(page, label, "No");
    await choose(page, "vaccinated", "Yes");
    await page.getByLabel("GP name").fill("Dr Test");
    await page.getByLabel("GP telephone").fill("012345678");
    await page.getByLabel("GP address").fill("Test Clinic");
    await page.getByLabel("Parent / guardian 1", { exact: true }).fill("Test Parent");
    await page.getByLabel("Parent / guardian 1 mobile").fill("087abc1234567");
    await expect(page.getByLabel("Parent / guardian 1 mobile")).toHaveValue("0871234567");
    await page.getByLabel("Email").fill(parentEmail!);
    await page.getByLabel("Home address").fill("1 Test Road");
    await page.getByLabel("Alternative emergency contact").fill("Other Adult");
    await page.getByLabel("Alternative contact phone").fill("0861234567");
    await save.click();
    const saveFeedback = page.getByRole("alert").filter({ hasText: /Consent and medical details updated successfully|Unable to save the consent and medical details|required|Select Yes or No/i }).last();
    await expect(saveFeedback, `Parent consent save failed. Browser console: ${parentConsentSaveErrors.join("\n") || "no save error was logged"}`).toHaveText("Consent and medical details updated successfully.");
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
  const desktopSignOut = page.getByRole("banner").getByRole("button", { name: "Sign Out", exact: true });
  if (testInfo.project.name === "mobile-chromium") {
    const mobileMenuButton = page.getByRole("button", { name: "Open navigation menu" });
    await mobileMenuButton.click();
    // Header gates the MUI Menu through useBackDismiss. The trigger can leave the
    // accessibility tree once focus moves into the portal, so synchronize on the
    // mounted menu rather than re-reading the trigger after the click.
    const mobileMenu = page.getByRole("menu");
    await expect(mobileMenu).toBeVisible();
    const mobileSignOut = mobileMenu.getByRole("menuitem", { name: "Sign Out", exact: true });
    await expect(mobileSignOut).toBeVisible();
    await mobileSignOut.click();
  } else {
    await expect(desktopSignOut).toBeVisible();
    await desktopSignOut.click();
  }

  await expect(page).toHaveURL(/\/$/);
  await page.goto("/parent");
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();

  await page.getByLabel("Email").fill(parentEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText(/Your account is approved and linked to 2 member records/i)).toBeVisible();
});

test.describe("Parent Portal navigation on desktop and mobile", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Parent navigation runs on desktop Chromium and Pixel 7 Chromium.");
    test.skip(!password || !parentEmail, "Configure canonical E2E parent credentials.");
    await loginParent(page);
  });

  test("menu preserves the linked child, deep links and browser Back", async ({ page }) => {
    const childSelect = page.getByRole("combobox", { name: "Viewing information for" });
    await expect(childSelect).toBeVisible();
    const badgeworkLink = page.getByRole("navigation", { name: "Parent Portal sections" }).getByRole("link", { name: "Badgework" });
    const firstHref = await badgeworkLink.getAttribute("href");
    const firstChild = new URL(firstHref!, "http://localhost").searchParams.get("child") || "";
    expect(firstChild).not.toBe("");
    await expect(page.getByRole("combobox", { name: "Viewing information for" })).toBeVisible();
    await expect(badgeworkLink).toHaveAttribute("href", new RegExp(`child=${firstChild}#parent-adventure-skills`));

    await badgeworkLink.click();
    await expect(page).toHaveURL(/#parent-adventure-skills$/);
    await page.getByRole("link", { name: "Consent & Medical" }).click();
    await expect(page).toHaveURL(/#parent-medical-consent$/);
    await expect(page.getByRole("heading", { name: "Consent & Medical Forms" })).toBeInViewport();
    await page.goBack();
    await expect(page).toHaveURL(/#parent-adventure-skills$/);
    await expect(page).toHaveURL(new RegExp(`child=${firstChild}#parent-adventure-skills$`));

    await childSelect.click();
    const options = page.getByRole("option");
    await expect(options).toHaveCount(2);
    const secondChildOption = page.getByRole("option", { name: /Morgan Kavanagh/ });
    const secondChild = await secondChildOption.getAttribute("data-value");
    expect(secondChild).toBeTruthy();
    await secondChildOption.click();
    await expect(page).toHaveURL(new RegExp(`child=${secondChild}`));
    await expect(page.getByRole("combobox", { name: "Viewing information for" })).toContainText("Morgan Kavanagh");
    await page.getByRole("link", { name: "Meetings & Events" }).click();
    await expect(page).toHaveURL(new RegExp(`child=${secondChild}#parent-event-consent$`));

    await page.goto(`/parent?child=UNLINKED_MEMBER#parent-event-consent`);
    await expect(page).toHaveURL(new RegExp(`child=${firstChild}#parent-event-consent$`));
    await expect(page.getByRole("heading", { name: "Upcoming Events & Event Consent" })).toBeInViewport();
  });
});
