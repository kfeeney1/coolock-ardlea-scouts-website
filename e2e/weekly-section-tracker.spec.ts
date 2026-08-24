import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
const groupLeaderEmail = process.env.E2E_GROUP_LEADER_EMAIL;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const futureDate = "2099-02-14";
const copiedDate = "2099-03-01";
const scoutMemberName = "Casey OBrien Scouts 01";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Weekly tracker lifecycle checks run once on desktop Chromium.");
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

test("section leader can plan, run, close and retrieve a meeting", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await login(page, leaderEmail!);
  await page.goto("/leader/weekly");

  await expect(page.getByRole("heading", { name: "Weekly Section Tracker" })).toBeVisible();
  await page.getByRole("button", { name: "Create Meeting" }).click();
  await expect(page.getByLabel("Location")).toHaveValue("Scout Den");
  await expect(page.getByLabel("Section")).toHaveText(/Scouts/);
  await page.getByLabel("Meeting date").fill(futureDate);
  await page.getByLabel("Location").fill("TEST Community Sports Hall");
  await page.getByLabel("Planned games & activities").fill("TEST Sharks and Minnows\nTEST Relay Race");
  await page.getByLabel("Planned badgework").fill("TEST Pioneering Badge");
  await page.getByRole("button", { name: "Create & Track Attendance" }).click();

  await expect(page.getByText("TEST Community Sports Hall")).toBeVisible();
  const attendance = page.getByRole("checkbox", { name: `Present · ${scoutMemberName}` });
  await expect(attendance).toBeVisible();
  await attendance.check();
  await expect(attendance).toBeChecked();

  await page.getByRole("button", { name: "2. Badgework" }).click();
  await page.getByLabel(`Badgework completed · ${scoutMemberName}`).fill("TEST Pioneering Badge");

  await page.getByRole("button", { name: "3. Injuries / Medical" }).click();
  await page.getByLabel("Member").click();
  await page.getByRole("option", { name: scoutMemberName }).click();
  await page.getByLabel("Injury / medical issue").fill("TEST minor graze");
  await page.getByLabel("Action taken").fill("TEST cleaned and parent informed");
  await page.getByRole("button", { name: "Add medical record" }).click();
  await expect(page.getByText("TEST minor graze")).toBeVisible();

  await page.getByRole("button", { name: "4. Additional Notes" }).click();
  await page.getByLabel("Additional notes").fill("TEST meeting lifecycle notes");
  await page.getByRole("button", { name: "Save Progress" }).click();
  await expect(page.getByText("Meeting progress saved.")).toBeVisible();

  await page.getByRole("button", { name: "Close Meeting" }).click();
  await expect(page.getByText("Meeting closed and added to meeting history.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meeting history" })).toBeVisible();
  await expect(page.getByText("TEST Community Sports Hall")).toBeVisible();

  await page.reload();
  await expect(page.getByText("TEST Community Sports Hall")).toBeVisible();
  await page.getByRole("button", { name: "Edit Meeting" }).first().click();
  await page.getByRole("button", { name: "4. Additional Notes" }).click();
  await expect(page.getByLabel("Additional notes")).toHaveValue("TEST meeting lifecycle notes");
});

test("closed meeting structure can be copied to a future date without old meeting results", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await login(page, leaderEmail!);
  await page.goto("/leader/weekly");

  const copyDate = page.getByLabel("Copy to date").first();
  await copyDate.fill(copiedDate);
  await page.getByRole("button", { name: "Copy to Date" }).first().click();
  await expect(page.getByText(/Meeting copied to/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planned & open meetings" })).toBeVisible();

  const copiedMeeting = page.getByRole("button", { name: "Open Meeting" }).filter({ has: undefined }).first();
  await copiedMeeting.click();
  await expect(page.getByText(/planned/)).toBeVisible();
  await page.getByRole("button", { name: "1. Attendance" }).click();
  const attendanceList = page.getByTestId("attendance-list");
  const checkboxes = attendanceList.getByRole("checkbox");
  const count = await checkboxes.count();
  for (let i = 0; i < count; i += 1) await expect(checkboxes.nth(i)).not.toBeChecked();
  await page.getByRole("button", { name: "2. Badgework" }).click();
  await expect(page.getByLabel(`Badgework completed · ${scoutMemberName}`)).toHaveValue("");
  await page.getByRole("button", { name: "3. Injuries / Medical" }).click();
  await expect(page.getByText("TEST minor graze")).toHaveCount(0);
  await page.getByRole("button", { name: "4. Additional Notes" }).click();
  await expect(page.getByLabel("Additional notes")).toHaveValue("");
});

test("group leader can manage weekly meetings across sections", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !groupLeaderEmail, "Configure canonical E2E Group Leader credentials.");
  await login(page, groupLeaderEmail!);
  await page.goto("/leader/weekly");
  await page.getByRole("button", { name: "Create Meeting" }).click();
  await page.getByLabel("Section").click();
  await expect(page.getByRole("option", { name: "Beavers" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Cubs" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Scouts" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Meeting history" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit Meeting" }).first()).toBeVisible();
});

test("administrator can load all planned and historical weekly meetings", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");
  await login(page, adminEmail!);
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Weekly Section Tracker" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Planned & open meetings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meeting history" })).toBeVisible();
  await expect(page.getByText(/Unable to load weekly meetings/i)).toHaveCount(0);
});
