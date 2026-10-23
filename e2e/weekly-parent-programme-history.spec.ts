import { expect, test, type Page } from "@playwright/test";
import { scheduleFixtureDb } from "./support/schedule-fixtures";

const password = process.env.E2E_TEST_USER_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL;

function shiftDate(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

async function loginParent(page: Page) {
  await page.goto("/parent");
  await page.getByLabel("Email").fill(parentEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText(/Your account is approved and linked to 2 member records/i)).toBeVisible();
  await expect(page.getByTestId("parent-weekly-default")).toBeVisible();
}

test("parent can browse recent meetings and historical meetings with linked-section access on desktop and mobile", async ({ page }) => {
  test.skip(!password || !parentEmail, "Configure canonical E2E parent credentials.");
  // The suite may cross Dublin midnight after seeding. Keep the browser's
  // relative programme partition on the same day as the canonical fixtures.
  const fixture = await scheduleFixtureDb().doc("parentWeeklyMeetings/TEST_sw415_parent_meeting_today").get();
  expect(fixture.exists).toBe(true);
  const today = fixture.data()?.meetingDate;
  expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  const noon = new Date(`${today}T12:00:00Z`);
  expect(noon.toISOString().slice(0, 10)).toBe(today);
  await page.clock.setFixedTime(noon);
  await loginParent(page);
  const upcoming = page.getByTestId("parent-weekly-default");
  const todayMeeting = upcoming.getByTestId("parent-weekly-meeting-TEST_sw415_parent_meeting_today");
  const futureMeeting = upcoming.getByTestId("parent-weekly-meeting-TEST_sw415_parent_meeting_future");
  const previousMeeting = upcoming.getByTestId("parent-weekly-meeting-TEST_sw415_parent_meeting_previous");
  await expect(todayMeeting).toContainText(shiftDate(today, 0).split("-").reverse().join("-"));
  await expect(todayMeeting).toContainText("Planned / Open");
  await expect(futureMeeting).toContainText("SW-415 future planned activity");
  await expect(previousMeeting).toContainText(shiftDate(today, -1).split("-").reverse().join("-"));
  await expect(previousMeeting).toContainText("Completed");
  await expect(upcoming.getByTestId("parent-weekly-meeting-TEST_sw415_parent_meeting_history")).toHaveCount(0);
  await expect(upcoming.getByTestId("parent-weekly-meeting-TEST_sw415_unlinked_section_history")).toHaveCount(0);
  await expect(page.getByTestId("parent-weekly-programme")).not.toContainText(/SW-415 private child name|SW-415 completed badgework|SW-415 private incident|SW-415 private leader note|SW-415 private post-meeting note/);

  const historyButton = upcoming.getByRole("link", { name: "View historical meetings" });
  const historyHref = await historyButton.getAttribute("href");
  expect(historyHref).toContain("meetings=history");
  await historyButton.click();

  const history = page.getByTestId("parent-weekly-history");
  await expect(history).toBeVisible();
  await expect(history.getByTestId("parent-weekly-meeting-TEST_sw415_parent_meeting_history")).toContainText("SW-415 historical planned activity");
  await expect(history.getByTestId("parent-weekly-meeting-TEST_sw415_parent_meeting_previous")).toHaveCount(0);
  await expect(history.getByTestId("parent-weekly-meeting-TEST_sw415_unlinked_section_history")).toHaveCount(0);
  await expect(history).not.toContainText(/SW-415 private child name|SW-415 completed badgework|SW-415 private incident|SW-415 private leader note|SW-415 private post-meeting note/);

  await page.reload();
  await expect(page).toHaveURL(/meetings=history/);
  await expect(page.getByTestId("parent-weekly-history").getByTestId("parent-weekly-meeting-TEST_sw415_parent_meeting_history")).toBeVisible();
  await page.getByRole("link", { name: "Back to weekly meeting programme" }).click();
  await expect(page).not.toHaveURL(/meetings=history/);
  await expect(page.getByTestId("parent-weekly-default").getByTestId("parent-weekly-meeting-TEST_sw415_parent_meeting_history")).toHaveCount(0);

  await page.getByTestId("view-historical-meetings").click();
  await expect(page.getByTestId("parent-weekly-history")).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/meetings=history/);
  await expect(page.getByTestId("parent-weekly-default")).toBeVisible();

  expect(historyHref).toBeTruthy();
  await page.goto(new URL(historyHref!, page.url()).toString());
  await expect(page.getByTestId("parent-weekly-history")).toBeVisible();
  await expect(page.getByTestId("parent-weekly-history").getByTestId("parent-weekly-meeting-TEST_sw415_parent_meeting_history")).toBeVisible();
  await page.reload();
  await expect(page).toHaveURL(/meetings=history/);
  await expect(page.getByRole("link", { name: "Back to weekly meeting programme" })).toBeVisible();
});
