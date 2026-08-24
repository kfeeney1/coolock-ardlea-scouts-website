import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
const fixtureTitle = "TEST E2E Scout Leader Meeting";

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

test("administrator can select Group Council meeting", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page, "test.webadmin@example.com");
  await page.goto("/leader/meetings");
  await expect(page.getByRole("heading", { name: "Meeting Records" })).toBeVisible();
  await openMeetingType(page);
  await expect(page.getByRole("option", { name: "Group Council Meeting", exact: true })).toBeVisible();
});
