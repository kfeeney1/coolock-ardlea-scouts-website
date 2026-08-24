import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
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

test("weekly tracker rejects unauthenticated users", async ({ page }) => {
  await page.goto("/leader/weekly");
  await expect(page).toHaveURL(/\/leader\/login$/);
});

test("section leader can take attendance with checkboxes and retrieve it after reload", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await login(page, leaderEmail!);
  await page.goto("/leader/weekly");

  await expect(page.getByRole("heading", { name: "Weekly Section Tracker" })).toBeVisible();
  await expect(page.getByLabel("Section")).toHaveText(/Scouts/);
  await page.getByLabel("Meeting date").fill(fixtureDate);

  const attendance = page.getByRole("checkbox", { name: `Present · ${scoutMemberName}` });
  await expect(attendance).toBeVisible();
  if (!(await attendance.isChecked())) await attendance.check();
  await expect(attendance).toBeChecked();

  await page.getByRole("button", { name: /Attendance$/ }).click();
  await expect(page.getByText(/Attendance (saved|updated)\./)).toBeVisible();

  await page.reload();
  await page.getByLabel("Meeting date").fill(fixtureDate);
  await expect(page.getByRole("checkbox", { name: `Present · ${scoutMemberName}` })).toBeChecked();
  await expect(page.getByRole("heading", { name: "Attendance history" })).toBeVisible();
  await expect(page.getByText(/weekly history cannot be loaded/i)).toHaveCount(0);
});

test("mark all present supports fast roll call and optional details remain secondary", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await login(page, leaderEmail!);
  await page.goto("/leader/weekly");
  await page.getByLabel("Meeting date").fill(fixtureDate);

  const attendanceList = page.getByTestId("attendance-list");
  await expect(attendanceList.getByRole("checkbox").first()).toBeVisible();
  await page.getByRole("button", { name: "Mark all present" }).click();
  const checkboxes = attendanceList.getByRole("checkbox");
  const count = await checkboxes.count();
  for (let i = 0; i < count; i += 1) await expect(checkboxes.nth(i)).toBeChecked();

  await expect(page.getByLabel("Weekly notes")).toHaveCount(0);
  await page.getByRole("button", { name: "Add subs, badges & notes" }).click();
  await expect(page.getByLabel("Weekly notes")).toBeVisible();
});

test("administrator can choose all sections and load weekly history", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");
  await login(page, adminEmail!);
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Weekly Section Tracker" })).toBeVisible();
  await expect(page.getByText(/weekly history cannot be loaded/i)).toHaveCount(0);
  await page.getByLabel("Section").click();
  await expect(page.getByRole("option", { name: "Beavers" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Cubs" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Scouts" })).toBeVisible();
});
