import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const primaryEmail = process.env.E2E_LEADER_EMAIL || "test.scout.programme.scouter@example.com";
const multiSectionEmail = process.env.E2E_MULTI_SECTION_LEADER_EMAIL || "test.multi.section.leader@example.com";

async function signIn(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function advance(page: Page) {
  await page.getByRole("button", { name: "Continue" }).click();
}

test("SW-309 inherits own profile details, persists edits, renews without old approval, and isolates another multi-section Scouter", async ({ page, browser }, testInfo: TestInfo) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD for the seeded Scouter accounts.");
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Scouter consent inheritance runs on desktop and Pixel 7 mobile Chromium.");

  await signIn(page, primaryEmail);
  await page.goto("/leader/profile/consent");
  await expect(page.getByText("Applicant Details")).toBeVisible();
  await expect(page.getByLabel("Applicant name")).toHaveValue("Test Scouts Scouter");
  await expect(page.getByLabel("Date of birth")).toHaveValue("1985-04-12");
  await expect(page.getByLabel("Address")).toHaveValue("42 Test Scouter Road");
  await expect(page.locator('input[name="mobile"]')).toHaveValue("0861234567");
  await expect(page.locator('input[name="homePhone"]')).toHaveValue("012345678");
  await expect(page.locator('input[name="workPhone"]')).toHaveValue("019876543");

  // A change made after prefill is saved as consent data and remains authoritative
  // on renewal even though the registration/profile defaults still have the old value.
  await page.locator('input[name="mobile"]').fill("0855550000");
  await advance(page);
  await page.getByLabel("Name", { exact: true }).fill("Test Emergency Contact");
  await page.getByLabel("Mobile", { exact: true }).fill("0871234567");
  await advance(page);
  for (const condition of ["Epilepsy", "Diabetes", "Asthma", "Heart Disease", "High Blood Pressure", "Skin Allergies", "Hearing Difficulties"]) {
    await page.getByText(condition, { exact: true }).locator("..").getByRole("radio", { name: "No" }).check();
  }
  await advance(page);
  await page.getByText("Are you currently taking any medication?", { exact: true }).locator("..").getByRole("radio", { name: "No" }).check();
  await advance(page);
  await page.getByLabel("Signature (full name)").fill("Scouts Programme Scouter");
  await page.getByRole("checkbox", { name: /confirm the declaration/i }).check();
  await page.getByRole("button", { name: "Submit Scouter Form" }).click();
  await expect(page.getByText("The Scouter ES3 medical advice form has been submitted successfully.")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Applicant Details")).toBeVisible();
  await expect(page.getByLabel("Applicant name")).toHaveValue("Test Scouts Scouter");
  await expect(page.locator('input[name="mobile"]')).toHaveValue("0855550000");
  await expect(page.getByLabel("Signature (full name)")).toHaveValue("");
  await expect(page.getByRole("checkbox", { name: /confirm the declaration/i })).not.toBeChecked();

  const otherContext = await browser.newContext({
    viewport: testInfo.project.name === "mobile-chromium" ? { width: 412, height: 915 } : { width: 1280, height: 800 },
    isMobile: testInfo.project.name === "mobile-chromium",
    hasTouch: testInfo.project.name === "mobile-chromium"
  });
  try {
    const otherPage = await otherContext.newPage();
    await signIn(otherPage, multiSectionEmail);
    await otherPage.goto("/leader/profile/consent");
    await expect(otherPage.getByText("Applicant Details")).toBeVisible();
    await expect(otherPage.getByLabel("Applicant name")).toHaveValue("Test Multi Section Leader");
    await expect(otherPage.getByLabel("Applicant name")).not.toHaveValue("Test Scouts Scouter");
    await expect(otherPage.locator('input[name="mobile"]')).toHaveValue("0872000000");
    await expect(otherPage.locator('input[name="address"]')).toHaveValue("");
    await otherPage.locator('input[name="address"]').fill("Entered manually");
    await expect(otherPage.locator('input[name="address"]')).toHaveValue("Entered manually");
  } finally {
    await otherContext.close();
  }
});
