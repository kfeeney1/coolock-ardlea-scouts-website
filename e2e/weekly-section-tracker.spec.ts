import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
const fixtureDate = "2099-01-15";
const scoutMemberName = "Casey OBrien Scouts 01";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Weekly tracker role checks run once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

function memberRow(page: Page, memberName: string) {
  return page.getByLabel(`Attendance · ${memberName}`).locator("xpath=ancestor::*[contains(@class, 'MuiPaper-root')][1]");
}

test("weekly tracker rejects unauthenticated users", async ({ page }) => {
  await page.goto("/leader/weekly");
  await expect(page).toHaveURL(/\/leader\/login$/);
});

test("section leader loads active members and persists weekly attendance subs and badges", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await login(page, leaderEmail!);
  await page.goto("/leader/weekly");

  await expect(page.getByRole("heading", { name: "Weekly Section Tracker" })).toBeVisible();
  await expect(page.getByLabel("Section")).toHaveText(/Scouts/);
  await page.getByLabel("Meeting date").fill(fixtureDate);

  let member = memberRow(page, scoutMemberName);
  await expect(member).toBeVisible();

  await member.getByLabel(`Attendance · ${scoutMemberName}`).click();
  await page.getByRole("option", { name: "Present", exact: true }).click();
  await member.getByRole("checkbox", { name: "Subs paid" }).check();
  await member.getByLabel("€").fill("4");
  await member.getByLabel("Badges achieved").fill("Navigator, Adventure Skills");
  await page.getByLabel("Weekly notes").fill("TEST Playwright weekly persistence check.");

  await page.getByRole("button", { name: "Update Weekly Record" }).click();
  await expect(page.getByText("Weekly meeting record updated.")).toBeVisible();

  await page.reload();
  await page.getByLabel("Meeting date").fill(fixtureDate);
  member = memberRow(page, scoutMemberName);
  await expect(member).toBeVisible();
  await expect(member.getByLabel(`Attendance · ${scoutMemberName}`)).toHaveText(/Present/);
  await expect(member.getByRole("checkbox", { name: "Subs paid" })).toBeChecked();
  await expect(member.getByLabel("€")).toHaveValue("4");
  await expect(member.getByLabel("Badges achieved")).toHaveValue("Navigator, Adventure Skills");
  await expect(page.getByLabel("Weekly notes")).toHaveValue("TEST Playwright weekly persistence check.");
});

test("administrator can choose from all standard sections", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page, "test.webadmin@example.com");
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Weekly Section Tracker" })).toBeVisible();
  await page.getByLabel("Section").click();
  await expect(page.getByRole("option", { name: "Beavers" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Cubs" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Scouts" })).toBeVisible();
});
