import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
const fixtureTitle = "TEST E2E Scout Leader Meeting";
const groupFixtureTitle = "TEST E2E Group Council Meeting";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Meeting role checks run once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function openMeetingType(page: Page) {
  const combobox = page.getByRole("combobox", { name: "Meeting type" });
  await expect(combobox).toBeVisible();
  await combobox.click();
}

test("meeting records rejects unauthenticated users", async ({ page }) => {
  await page.goto("/leader/meetings");
  await expect(page).toHaveURL(/\/leader\/login$/);
});

test("section leader sees only section meeting type and can persist edits", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await login(page, leaderEmail!);
  await page.goto("/leader/meetings");

  await expect(page.getByRole("heading", { name: "Meeting Records" })).toBeVisible();
  await expect(page.getByLabel("Section")).toBeVisible();
  await openMeetingType(page);
  await expect(page.getByRole("option", { name: "Leader / Section Meeting", exact: true })).toBeVisible();
  await expect(page.getByRole("option", { name: "Group Leaders Meeting", exact: true })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Group Council Meeting", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");

  const fixtureHeading = page.getByText(fixtureTitle, { exact: true });
  await expect(fixtureHeading).toBeVisible();
  await expect(page.getByText(groupFixtureTitle, { exact: true })).toHaveCount(0);
  const fixtureHeader = fixtureHeading.locator("..").locator("..");
  await fixtureHeader.getByRole("button", { name: "Edit" }).click();

  await expect(page.getByLabel("Meeting title")).toHaveValue(fixtureTitle);
  await page.getByLabel("Notes / Minutes").fill("TEST Playwright meeting persistence check.");
  await page.getByRole("button", { name: "Update Meeting" }).click();
  await expect(page.getByText(/Meeting record updated/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(fixtureTitle, { exact: true })).toBeVisible();
  await expect(page.getByText("TEST Playwright meeting persistence check.", { exact: true })).toBeVisible();
});

test("section leader can import a text meeting document, review it and save it", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await login(page, leaderEmail!);
  await page.goto("/leader/meetings");

  const title = `TEST E2E Imported Meeting ${Date.now()}`;
  const importedMinutes = "TEST imported minutes remain editable before save.";
  const documentText = [
    `Title: ${title}`,
    "Meeting Type: Leader / Section Meeting",
    "Section: Scouts",
    "Date: 05/09/2026 19:30",
    "Attendees:",
    "- Test Scout Leader",
    "- Test Assistant Leader",
    "Minutes:",
    importedMinutes,
    "Decisions:",
    "TEST use the den as the wet-weather fallback.",
    "Action Items:",
    "TEST confirm programme equipment."
  ].join("\n");

  await page.locator('input[type="file"][accept*=".txt"]').setInputFiles({
    name: "TEST-imported-meeting.txt",
    mimeType: "text/plain",
    buffer: Buffer.from(documentText)
  });

  await expect(page.getByText(/Imported draft from TEST-imported-meeting\.txt/)).toBeVisible();
  await expect(page.getByText(/Review every field below before saving/)).toBeVisible();
  await expect(page.getByLabel("Meeting title")).toHaveValue(title);
  await expect(page.getByLabel("Meeting date and time")).toHaveValue("2026-09-05T19:30");
  await expect(page.getByLabel("Attendees")).toHaveValue("Test Scout Leader\nTest Assistant Leader");
  await expect(page.getByLabel("Notes / Minutes")).toHaveValue(importedMinutes);
  await expect(page.getByLabel("Decisions")).toHaveValue("TEST use the den as the wet-weather fallback.");
  await expect(page.getByLabel("Action Items")).toHaveValue("TEST confirm programme equipment.");

  await page.getByLabel("Notes / Minutes").fill(`${importedMinutes} Reviewed by Playwright.`);
  await page.getByRole("button", { name: "Save Meeting" }).click();
  await expect(page.getByText("Meeting record saved.")).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByText(`${importedMinutes} Reviewed by Playwright.`, { exact: true })).toBeVisible();
});

test("editing a meeting on mobile scrolls the edit form into view instead of the page top", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Mobile edit-scroll regression runs once on Chromium.");
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, leaderEmail!);
  await page.goto("/leader/meetings");

  const fixtureHeading = page.getByText(fixtureTitle, { exact: true });
  await expect(fixtureHeading).toBeVisible();
  await fixtureHeading.scrollIntoViewIfNeeded();
  await fixtureHeading.locator("..").locator("..").getByRole("button", { name: "Edit" }).click();

  const form = page.getByTestId("meeting-record-form");
  await expect(form).toBeInViewport();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).not.toBeInViewport();
  await expect(page.getByLabel("Meeting title")).toHaveValue(fixtureTitle);
});

for (const officer of [
  { role: "Group Leader", email: "test.group.leader@example.com" },
  { role: "Group Secretary", email: "test.group.secretary@example.com" }
]) {
  test(`${officer.role} can read all meeting history without admin edit controls`, async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await login(page, officer.email);
    await page.goto("/leader/meetings");

    await expect(page.getByRole("heading", { name: "Meeting Records" })).toBeVisible();
    await expect(page.getByText("Unable to load meeting records for your permitted scope.")).toHaveCount(0);
    await expect(page.getByText(fixtureTitle, { exact: true })).toBeVisible();
    await expect(page.getByText(groupFixtureTitle, { exact: true })).toBeVisible();

    await openMeetingType(page);
    await expect(page.getByRole("option", { name: "Group Leaders Meeting", exact: true })).toHaveCount(0);
    await expect(page.getByRole("option", { name: "Group Council Meeting", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");

    const scoutRecord = page.getByText(fixtureTitle, { exact: true }).locator("..").locator("..");
    const groupRecord = page.getByText(groupFixtureTitle, { exact: true }).locator("..").locator("..");
    await expect(scoutRecord.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(groupRecord.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(scoutRecord.getByRole("button", { name: "Version History" })).toHaveCount(0);
  });
}

test("administrator can save and retrieve a Group Council meeting", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page, "test.webadmin@example.com");
  await page.goto("/leader/meetings");
  await expect(page.getByRole("heading", { name: "Meeting Records" })).toBeVisible();
  await expect(page.getByText("Unable to load meeting records for your permitted scope.")).toHaveCount(0);

  await openMeetingType(page);
  await expect(page.getByRole("option", { name: "Group Leaders Meeting", exact: true })).toBeVisible();
  await page.getByRole("option", { name: "Group Council Meeting", exact: true }).click();

  const title = `TEST E2E Group Council ${Date.now()}`;
  await page.getByLabel("Meeting title").fill(title);
  await page.getByLabel("Meeting date and time").fill("2026-08-24T19:30");
  await page.getByLabel("Attendees").fill("Test Web Admin\nTest Group Leader");
  await page.getByLabel("Notes / Minutes").fill("TEST admin meeting persistence check.");
  await page.getByRole("button", { name: "Save Meeting" }).click();

  await expect(page.getByText("Meeting record saved.")).toBeVisible();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Unable to load meeting records for your permitted scope.")).toHaveCount(0);
  await expect(page.getByText(title, { exact: true })).toBeVisible();
  await expect(page.getByText("TEST admin meeting persistence check.", { exact: true })).toBeVisible();
});

test("administrator can create a Group Leaders Meeting and retains the pre-edit version", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page, "test.webadmin@example.com");
  await page.goto("/leader/meetings");

  await openMeetingType(page);
  await page.getByRole("option", { name: "Group Leaders Meeting", exact: true }).click();

  const title = `TEST E2E Group Leaders ${Date.now()}`;
  const originalMinutes = "TEST original Group Leaders minutes retained for audit.";
  const revisedMinutes = "TEST revised Group Leaders minutes.";
  await page.getByLabel("Meeting title").fill(title);
  await page.getByLabel("Meeting date and time").fill("2026-08-25T20:00");
  await page.getByLabel("Attendees").fill("Test Group Leader\nTest Cub Leader\nTest Scout Leader");
  await page.getByLabel("Notes / Minutes").fill(originalMinutes);
  await page.getByRole("button", { name: "Save Meeting" }).click();

  const heading = page.getByText(title, { exact: true });
  await expect(heading).toBeVisible();
  let recordCard = heading.locator("..").locator("..").locator("..");
  await expect(recordCard.getByText("Group Leaders Meeting", { exact: true })).toBeVisible();
  await expect(recordCard.getByText("Group Leaders", { exact: true })).toBeVisible();
  await recordCard.getByRole("button", { name: "Edit" }).click();

  await page.getByLabel("Notes / Minutes").fill(revisedMinutes);
  await page.getByRole("button", { name: "Update Meeting" }).click();
  await expect(page.getByText(/previous version has been retained/i)).toBeVisible();
  await expect(page.getByText(revisedMinutes, { exact: true })).toBeVisible();

  recordCard = page.getByText(title, { exact: true }).locator("..").locator("..").locator("..");
  await recordCard.getByRole("button", { name: "Version History" }).click();
  await expect(recordCard.getByText("Previous versions", { exact: true })).toBeVisible();
  await expect(recordCard.getByText(originalMinutes, { exact: true })).toBeVisible();
});
