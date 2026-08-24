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
  await expect(page.getByText("Meeting record updated.")).toBeVisible();

  await page.reload();
  await expect(page.getByText(fixtureTitle, { exact: true })).toBeVisible();
  await expect(page.getByText("TEST Playwright meeting persistence check.", { exact: true })).toBeVisible();
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
    await expect(page.getByRole("option", { name: "Group Council Meeting", exact: true })).toHaveCount(0);
    await page.keyboard.press("Escape");

    const scoutRecord = page.getByText(fixtureTitle, { exact: true }).locator("..").locator("..");
    const groupRecord = page.getByText(groupFixtureTitle, { exact: true }).locator("..").locator("..");
    await expect(scoutRecord.getByRole("button", { name: "Edit" })).toHaveCount(0);
    await expect(groupRecord.getByRole("button", { name: "Edit" })).toHaveCount(0);
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
