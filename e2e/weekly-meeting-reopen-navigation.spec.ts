import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_SECTION_LEADER_EMAIL || "test.scout.section.leader@example.com";

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function displayDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
}

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(leaderEmail);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function findUnusedScoutsDate(page: Page, startDate: string) {
  for (let offset = 0; offset < 400; offset += 1) {
    const date = addDays(startDate, offset);
    const label = displayDate(date);
    if (await page.getByRole("button", { name: new RegExp(`${label} · Scouts`) }).count()) continue;
    if (await page.getByTestId(/meeting-history-/).filter({ hasText: `${label} · Scouts` }).count()) continue;
    return { date, label };
  }
  throw new Error(`No unused Scouts meeting date found from ${startDate}.`);
}

test("reopening a closed meeting loads that exact editable record, preserves data, and Back returns to the open list", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "SW-387 reopen navigation runs on desktop and mobile Chromium.");
  test.skip(!password, "Configure canonical E2E section leader credentials.");

  await login(page);
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Weekly Meetings" })).toBeVisible();
  const startDate = testInfo.project.name === "mobile-chromium" ? "2099-10-14" : "2098-10-14";
  const meeting = await findUnusedScoutsDate(page, startDate);

  await page.getByRole("link", { name: "Create Meeting" }).click();
  await page.getByLabel("Meeting date", { exact: true }).fill(meeting.date);
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=/);
  const meetingId = new URL(page.url()).searchParams.get("meeting");
  expect(meetingId).toBeTruthy();
  await expect(page.getByTestId("weekly-meeting-editor-top")).toBeVisible();

  const theme = `SW-387 reopen ${testInfo.project.name}`;
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  const attendance = page.getByRole("checkbox", { name: /Attendance ·/ }).first();
  await expect(attendance).toBeVisible();
  await attendance.check();
  await page.getByRole("button", { name: "Programme", exact: true }).click();
  await page.getByLabel("Theme").fill(theme);
  await page.getByLabel("Location").fill("Reopen navigation test den");
  await page.getByLabel("Activity 1", { exact: true }).fill("Saved navigation activity");
  await page.getByLabel("Badgework 1", { exact: true }).fill("Saved navigation badgework");
  await page.getByLabel("Programme notes").fill("Saved before close and reopen.");
  await page.getByRole("button", { name: "Injuries / Medical", exact: true }).click();
  await page.getByLabel("Member").click();
  await page.getByRole("option").first().click();
  await page.getByLabel("Injury / medical concern").fill("Saved reopen test incident");
  await page.getByLabel("Action taken").fill("Recorded for preservation check");
  await page.getByRole("checkbox", { name: "Parent informed" }).check();
  await page.getByRole("button", { name: "Add Incident", exact: true }).click();
  await expect(page.getByText(/Saved reopen test incident/)).toBeVisible();
  await page.getByRole("button", { name: "Save Meeting", exact: true }).click();
  await expect(page.getByText(/^Meeting saved\./)).toBeVisible();
  await page.getByRole("button", { name: "Close Meeting", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/leader/weekly");

  const historyCard = page.getByTestId(`meeting-history-${meetingId}`);
  await expect(historyCard).toContainText("Closed");
  await historyCard.getByRole("button", { name: "Reopen Meeting", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Reopen meeting?" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(confirmation).toHaveCount(0);
  await expect(page).toHaveURL((url) => url.pathname === "/leader/weekly");
  await expect(historyCard).toContainText("Closed");

  await historyCard.getByRole("button", { name: "Reopen Meeting", exact: true }).click();
  await page.getByRole("dialog", { name: "Reopen meeting?" }).getByRole("button", { name: "Reopen Meeting", exact: true }).click();

  await expect(page).toHaveURL(new RegExp(`/leader/weekly\\?meeting=${encodeURIComponent(meetingId!)}`));
  const editor = page.getByTestId("weekly-meeting-editor-top");
  await expect(editor).toBeVisible();
  await expect(editor).toContainText("Open");
  await expect(editor).toContainText(meeting.label);
  await expect(page.getByTestId("weekly-meeting-summary")).toContainText(theme);

  await page.getByRole("button", { name: "Programme", exact: true }).click();
  await expect(page.getByLabel("Theme")).toHaveValue(theme);
  await expect(page.getByLabel("Theme")).toBeEnabled();
  await expect(page.getByLabel("Location")).toHaveValue("Reopen navigation test den");
  await expect(page.getByLabel("Activity 1", { exact: true })).toHaveValue("Saved navigation activity");
  await expect(page.getByLabel("Badgework 1", { exact: true })).toHaveValue("Saved navigation badgework");
  await expect(page.getByLabel("Programme notes")).toHaveValue("Saved before close and reopen.");
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(attendance).toBeChecked();
  await page.getByRole("button", { name: "Injuries / Medical", exact: true }).click();
  await expect(page.getByText(/Saved reopen test incident/)).toBeVisible();
  await page.getByRole("button", { name: "Programme", exact: true }).click();

  await page.getByLabel("Theme").fill(`${theme} edited`);
  await page.getByRole("button", { name: "Save Meeting", exact: true }).click();
  await expect(page.getByText(/^Meeting saved\./)).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL((url) => url.pathname === "/leader/weekly");
  const openMeeting = page.getByRole("button", { name: new RegExp(`${meeting.label} · Scouts`) });
  await expect(openMeeting).toHaveCount(1);
  await expect(page.getByTestId(`meeting-history-${meetingId}`)).toHaveCount(0);
});
