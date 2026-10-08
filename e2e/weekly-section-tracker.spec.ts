import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
const sectionLeaderEmail = process.env.E2E_SECTION_LEADER_EMAIL || "test.scout.section.leader@example.com";
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const firstLifecycleDate = "2099-03-01";
const scoutMemberName = "Casey OBrien Scouts 01";
const scoutSectionLeader = "Scouts Section Leader · Section Leader";
const dualSectionMember = "TEST Dual Section Member";

type LifecycleMeeting = { date: string; label: string };

function displayMeetingDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return `${day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1]} ${year}`;
}

function addDays(date: string, days: number) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day + days));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

async function findUnusedMeetingDate(page: Page, startDate: string) {
  await expect(page.getByRole("heading", { name: "Weekly Meetings" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  for (let offset = 0; offset < 400; offset += 1) {
    const date = addDays(startDate, offset);
    const label = displayMeetingDate(date);
    const open = page.getByRole("button", { name: new RegExp(`${label} · Scouts`) });
    const closed = page.getByTestId(/meeting-history-/).filter({ hasText: `${label} · Scouts` });
    if (!(await open.count()) && !(await closed.count())) return { date, label };
  }
  throw new Error(`No unused Scouts meeting date found from ${startDate}.`);
}

function desktopOnly(testInfo: TestInfo) { test.skip(testInfo.project.name !== "chromium", "Weekly meeting lifecycle runs once on desktop Chromium."); }
async function login(page: Page, email: string) { await page.goto("/leader/login"); await page.getByLabel("Email address").fill(email); await page.getByLabel("Password").fill(password!); await page.getByRole("button", { name: "Sign In" }).click(); await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible(); }

async function createIsolatedLifecycleMeeting(page: Page): Promise<LifecycleMeeting> {
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Weekly Meetings" })).toBeVisible();
  const lifecycle = await findUnusedMeetingDate(page, firstLifecycleDate);
  await page.getByRole("link", { name: "Create Meeting" }).click();
  await expect(page.getByRole("heading", { name: "Create Meeting" })).toBeVisible();
  await page.getByLabel("Meeting date").fill(lifecycle.date);
  await page.getByRole("button", { name: "Create Meeting" }).click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=/);
  await page.goto("/leader/weekly");
  const createdMeeting = page.getByRole("button", { name: new RegExp(`${lifecycle.label} · Scouts`) });
  await expect(createdMeeting).toHaveCount(1);
  await expect(createdMeeting).toBeVisible();
  await createdMeeting.click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=/);
  return lifecycle;
}

async function normalizePlanner(page: Page) {
  await page.getByRole("button", { name: "Programme", exact: true }).click();
  let activityRows = page.getByTestId("activity-plan-row");
  while (await activityRows.count() > 2) { await activityRows.last().getByRole("button", { name: "Remove" }).click(); activityRows = page.getByTestId("activity-plan-row"); }
  while (await activityRows.count() < 2) { await page.getByRole("button", { name: "Add activity / game", exact: true }).click(); activityRows = page.getByTestId("activity-plan-row"); }
  let badgeRows = page.getByTestId("badgework-plan-row");
  while (await badgeRows.count() > 1) { await badgeRows.last().getByRole("button", { name: "Remove" }).click(); badgeRows = page.getByTestId("badgework-plan-row"); }
  while (await badgeRows.count() < 1) { await page.getByRole("button", { name: "Add badgework", exact: true }).click(); badgeRows = page.getByTestId("badgework-plan-row"); }
}

const firstActivityLeader = (page: Page) => page.getByTestId("activity-plan-row").first().getByRole("checkbox", { name: scoutSectionLeader, exact: true });
const firstBadgeworkLeader = (page: Page) => page.getByTestId("badgework-plan-row").first().getByRole("checkbox", { name: scoutSectionLeader, exact: true });

async function expectSectionLeaderHistoryRestrictions(page: Page) {
  await expect(page.getByTestId("past-meeting-edit-notice")).toContainText("only attendance, injuries / medical issues and additional notes can be changed");
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(page.getByRole("button", { name: "Mark all present", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: scoutMemberName, exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Programme", exact: true }).click();
  await expect(page.getByLabel("Theme")).toBeDisabled();
  await expect(page.getByLabel("Location")).toBeDisabled();
  await page.getByRole("button", { name: "Completed Badgework", exact: true }).click();
  const completedBadgework = page.getByLabel(`Badges · ${scoutMemberName}`);
  await expect(completedBadgework).toBeVisible();
  await expect(completedBadgework).toBeDisabled();
  await page.getByRole("button", { name: "Notes", exact: true }).click();
  await expect(page.getByLabel("Additional meeting notes")).toBeEnabled();
  await expect(page.getByRole("button", { name: "Save Meeting", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reopen Meeting", exact: true })).toHaveCount(0);
}

test("weekly meetings reject unauthenticated users", async ({ page }) => { await page.goto("/leader/weekly"); await expect(page).toHaveURL(/\/leader\/login$/); });

test("section leader completes lifecycle with flexible planner rows, summary and retained save state", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  desktopOnly(testInfo); test.skip(!password || !sectionLeaderEmail, "Configure canonical E2E section leader credentials.");
  await login(page, sectionLeaderEmail);
  const partialMeeting = await createIsolatedLifecycleMeeting(page);
  const lifecycle = await createIsolatedLifecycleMeeting(page);
  expect(lifecycle.date).not.toBe(partialMeeting.date);
  const phases = ["create/open"];
  const incidentDescription = "Small graze during wide game";

  await expect(page.getByTestId("weekly-meeting-summary")).toBeVisible();
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  const attendanceCheckbox = page.getByRole("checkbox", { name: scoutMemberName, exact: true });
  if (!await attendanceCheckbox.isChecked()) await page.getByRole("button", { name: "Mark all present", exact: true }).click();
  await expect(page.getByText(/(\d+)\/\1 Present/)).toBeVisible();
  await expect(attendanceCheckbox).toBeChecked();
  const uniformCheckbox = page.getByRole("checkbox", { name: `Uniform · ${scoutMemberName}`, exact: true });
  await uniformCheckbox.check();
  await page.getByRole("button", { name: "Meetings", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`${lifecycle.label} · Scouts`) }).click();
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(uniformCheckbox).toBeChecked();
  phases.push("attendance/uniform persistence");

  // Always create a real dirty state before navigating away to verify it is saved.
  await attendanceCheckbox.uncheck();
  await expect(attendanceCheckbox).not.toBeChecked();
  await page.getByRole("button", { name: "Meetings", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly$/);
  await page.getByRole("button", { name: new RegExp(`${lifecycle.label} · Scouts`) }).click();
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(attendanceCheckbox).not.toBeChecked();
  await page.getByRole("button", { name: "Mark all present", exact: true }).click();
  await expect(attendanceCheckbox).toBeChecked();

  await page.getByRole("button", { name: "Programme", exact: true }).click();
  await expect(page.getByTestId("activity-plan-row")).toHaveCount(2);
  await normalizePlanner(page);
  await page.getByLabel("Theme").fill("Navigation Night"); await page.getByLabel("Location").fill("Scout Den");
  await page.getByLabel("Activity 1", { exact: true }).fill("Wide game"); await firstActivityLeader(page).check(); await page.getByLabel("Equipment 1", { exact: true }).fill("Cones and maps"); await page.getByLabel("Activity duration (minutes) 1", { exact: true }).fill("25"); await page.getByLabel("Instructions / notes 1", { exact: true }).fill("Patrol navigation challenge");
  await page.getByLabel("Activity 2", { exact: true }).fill("Pioneering relay"); await page.getByLabel("Activity duration (minutes) 2", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Add activity / game", exact: true }).click(); await expect(page.getByTestId("activity-plan-row")).toHaveCount(3); await page.getByTestId("activity-plan-row").last().getByRole("button", { name: "Remove" }).click(); await expect(page.getByTestId("activity-plan-row")).toHaveCount(2); await page.getByRole("button", { name: "Add activity / game", exact: true }).click(); await page.getByLabel("Activity 3", { exact: true }).fill("Closing game"); await page.getByLabel("Activity duration (minutes) 3", { exact: true }).fill("10"); await page.getByLabel("Programme notes").fill("Reusable opening and patrol rotation.");

  await expect(page.getByTestId("badgework-plan-row")).toHaveCount(1);
  const badgework1=page.getByTestId("badgework-plan-row").first(); await badgework1.getByLabel("Badgework 1", { exact: true }).fill("Adventure Skills: Pioneering"); await firstBadgeworkLeader(page).check(); await badgework1.getByLabel("Badgework equipment 1", { exact: true }).fill("Rope and pioneering poles"); await badgework1.getByLabel("Badgework duration (minutes) 1", { exact: true }).fill("40"); await badgework1.getByLabel("Badgework instructions / notes 1", { exact: true }).fill("Stage 2 lashings");
  await page.getByRole("button", { name: "Add badgework", exact: true }).click(); await expect(page.getByTestId("badgework-plan-row")).toHaveCount(2); await page.getByTestId("badgework-plan-row").last().getByRole("button", { name: "Remove" }).click(); await expect(page.getByTestId("badgework-plan-row")).toHaveCount(1); await page.getByRole("button", { name: "Add badgework", exact: true }).click(); await page.getByLabel("Badgework 2", { exact: true }).fill("Teamwork"); await page.getByLabel("Badgework duration (minutes) 2", { exact: true }).fill("10");
  await expect(page.getByTestId("programme-duration-total")).toHaveText("Planned programme: 105 minutes"); await expect(page.getByTestId("programme-duration-warning")).toContainText("15 minutes longer than the standard 1½-hour meeting");
  phases.push("programme editing");

  await page.getByRole("button", { name: "Completed Badgework", exact: true }).click();
  await page.getByLabel(`Badges · ${scoutMemberName}`).fill("Pioneering Stage 2");

  await page.getByRole("button", { name: "Injuries / Medical", exact: true }).click(); if (!await page.getByText(/Small graze during wide game/).count()) { await page.getByLabel("Member").click(); await page.getByRole("option", { name: scoutMemberName }).click(); await expect(page.locator(".MuiModal-root")).toHaveCount(0); await page.getByLabel("Injury / medical concern").fill(incidentDescription); await page.getByLabel("Action taken").fill("Cleaned and covered"); await page.getByRole("checkbox", { name: "Parent informed" }).check(); await page.getByRole("button", { name: "Add Incident", exact: true }).click(); } await expect(page.getByText(/Small graze during wide game/)).toBeVisible();
  await page.getByRole("button", { name: "Notes", exact: true }).click(); await page.getByLabel("Additional meeting notes").fill("Visitors and equipment issue recorded after meeting."); await page.getByRole("button", { name: "Save Meeting", exact: true }).click(); await expect(page.getByText("Meeting saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByTestId("weekly-meeting-editor-top")).toBeVisible();
  await page.getByRole("button", { name: "Programme", exact: true }).click();
  await expect(page.getByLabel("Theme")).toHaveValue("Navigation Night");
  await expect(page.getByLabel("Location")).toHaveValue("Scout Den");
  await expect(page.getByLabel("Activity 1", { exact: true })).toHaveValue("Wide game");
  await expect(firstActivityLeader(page)).toBeChecked();
  await expect(page.getByLabel("Badgework 1", { exact: true })).toHaveValue("Adventure Skills: Pioneering");
  await expect(firstBadgeworkLeader(page)).toBeChecked();
  await expect(page.getByLabel("Programme notes")).toHaveValue("Reusable opening and patrol rotation.");
  phases.push("save/reload");

  const editorTop = page.getByTestId("weekly-meeting-editor-top");
  await expect(editorTop).toBeVisible();
  await expect(page.getByRole("heading", { name: "Create Meeting" })).toHaveCount(0);
  const summary = page.getByTestId("weekly-meeting-summary");
  await expect(summary).toContainText("Scout Den");
  await expect(summary).toContainText("Navigation Night");
  await expect(summary).toContainText("3 activities / games");
  await expect(summary).toContainText("2 badgework");
  await expect(summary).toContainText("105 min planned");
  await expect(summary).toContainText(/(\d+)\/\1 present/);

  await page.getByRole("button", { name: "Programme", exact: true }).click(); await expect(page.getByTestId("activity-plan-row")).toHaveCount(3); await expect(page.getByLabel("Activity 1", { exact: true })).toHaveValue("Wide game"); await expect(firstActivityLeader(page)).toBeChecked(); await expect(page.getByLabel("Activity duration (minutes) 1", { exact: true })).toHaveValue("25"); await expect(page.getByTestId("badgework-plan-row")).toHaveCount(2); await expect(page.getByLabel("Badgework 2", { exact: true })).toHaveValue("Teamwork"); await expect(firstBadgeworkLeader(page)).toBeChecked(); await expect(page.getByLabel("Badgework equipment 1", { exact: true })).toHaveValue("Rope and pioneering poles"); await expect(page.getByLabel("Badgework duration (minutes) 1", { exact: true })).toHaveValue("40"); await expect(page.getByTestId("programme-duration-warning")).toBeVisible();
  await page.getByLabel("Theme").fill("Unsaved navigation draft"); await page.getByRole("button", { name: "Copy Meeting", exact: true }).click(); await expect(page.getByTestId("weekly-meeting-copy-form")).toBeVisible(); await expect(page.getByText("Meeting saved.")).toBeVisible(); await page.getByRole("button", { name: "Cancel", exact: true }).click(); await page.getByRole("button", { name: new RegExp(`${lifecycle.label} · Scouts`) }).click(); await page.getByRole("button", { name: "Programme", exact: true }).click(); await expect(page.getByLabel("Theme")).toHaveValue("Unsaved navigation draft"); await page.getByLabel("Theme").fill("Navigation Night"); await page.getByRole("button", { name: "Save Meeting", exact: true }).click(); await expect(page.getByText("Meeting saved.")).toBeVisible();

  const editedDate = addDays(lifecycle.date, 1);
  await page.getByRole("button", { name: "Edit Meeting", exact: true }).click(); await page.getByLabel("Meeting date").fill(editedDate); await page.getByRole("button", { name: "Save Meeting", exact: true }).click(); await page.reload(); await page.getByRole("button", { name: "Programme", exact: true }).click(); await expect(page.getByLabel("Meeting date")).toHaveValue(editedDate); await page.getByLabel("Meeting date").fill(lifecycle.date); await page.getByRole("button", { name: "Save Meeting", exact: true }).click();
  phases.push("meeting edit");

  await page.getByRole("button", { name: "Close Meeting", exact: true }).click(); await expect(page).toHaveURL((url) => url.pathname === "/leader/weekly"); const historyCard = page.getByTestId(/meeting-history-/).filter({ hasText: `${lifecycle.label} · Scouts` }); await expect(historyCard).toContainText("3 activities · 2 badgework"); phases.push("close/history"); await historyCard.getByRole("button", { name: "View / Edit", exact: true }).click(); await expectSectionLeaderHistoryRestrictions(page);

  await page.getByRole("button", { name: "Meetings", exact: true }).click(); const closedCard = page.getByTestId(/meeting-history-/).filter({ hasText: `${lifecycle.label} · Scouts` }); const copyDate = (await findUnusedMeetingDate(page, addDays(lifecycle.date, 7))).date; await closedCard.getByRole("button", { name: "Copy Meeting", exact: true }).click(); await page.getByLabel("Choose date").fill(copyDate); await page.getByRole("button", { name: "Create Copy", exact: true }).click(); await expect(page.getByText(/Meeting copied\. Planner rows and planned equipment were retained/)).toBeVisible(); phases.push("copy");
  await page.getByRole("button", { name: "Attendance", exact: true }).click(); await expect(page.getByText(/Present/).first()).toBeVisible();
  await page.getByRole("button", { name: "Programme", exact: true }).click(); await expect(page.getByLabel("Theme")).toHaveValue("Navigation Night"); await expect(page.getByTestId("activity-plan-row")).toHaveCount(3); await expect(page.getByLabel("Activity 1", { exact: true })).toHaveValue("Wide game"); await expect(firstActivityLeader(page)).toBeChecked(); await expect(page.getByLabel("Equipment 1", { exact: true })).toHaveValue("Cones and maps"); await expect(page.getByLabel("Activity duration (minutes) 1", { exact: true })).toHaveValue("25"); await expect(page.getByTestId("badgework-plan-row")).toHaveCount(2); await expect(page.getByLabel("Badgework 1", { exact: true })).toHaveValue("Adventure Skills: Pioneering"); await expect(firstBadgeworkLeader(page)).toBeChecked(); await expect(page.getByLabel("Badgework duration (minutes) 1", { exact: true })).toHaveValue("40"); await expect(page.getByTestId("programme-duration-total")).toHaveText("Planned programme: 105 minutes");
  await page.getByRole("button", { name: "Completed Badgework", exact: true }).click(); await expect(page.getByText("Mark attendees present before recording completed badgework.")).toBeVisible();
  await page.getByRole("button", { name: "Injuries / Medical", exact: true }).click(); await expect(page.getByText(/Small graze during wide game/)).toHaveCount(0); await page.getByRole("button", { name: "Notes", exact: true }).click(); await expect(page.getByLabel("Additional meeting notes")).toHaveValue("");
  expect(phases).toEqual(["create/open", "attendance/uniform persistence", "programme editing", "save/reload", "meeting edit", "close/history", "copy"]);
});

test("seeded meeting history is stable, varied and findable for every section", async ({ page }, testInfo) => { desktopOnly(testInfo); test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials."); await login(page, adminEmail!); await page.goto("/leader/weekly"); await expect(page.getByRole("heading", { name: "Meeting History" })).toBeVisible(); for (const section of ["Beavers","Cubs","Scouts","Ventures","Rovers"]) await expect(page.getByText(new RegExp(`· ${section}$`)).first()).toBeVisible(); await expect(page.getByText(/1 activities · 1 badgework/).first()).toBeVisible(); await expect(page.getByText(/3 activities · 1 badgework/).first()).toBeVisible(); await expect(page.getByText(/1 activities · 3 badgework/).first()).toBeVisible(); await page.getByLabel("Meeting history section").click(); await page.getByRole("option", { name: "Beavers", exact: true }).click(); await expect(page.getByTestId("weekly-history-result-count")).toContainText(/Showing \d+ of \d+ closed meetings/); await expect(page.getByText(/· Beavers$/).first()).toBeVisible(); await expect(page.getByText(/· Rovers$/)).toHaveCount(0); await page.getByLabel("From date").fill("2100-01-01"); await expect(page.getByTestId("weekly-history-no-results")).toBeVisible(); await page.getByTestId("weekly-history-reset").click(); await expect(page.getByText(/· Rovers$/).first()).toBeVisible(); });
test("group leader can create meetings across sections", async ({ page }, testInfo) => { desktopOnly(testInfo); test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials."); await login(page, adminEmail!); await page.goto("/leader/weekly/create"); await expect(page.getByRole("heading", { name: "Create Meeting" })).toBeVisible(); const section=page.getByRole("combobox", { name: "Section" }); await expect(section).toBeVisible(); await section.click(); await expect(page.getByRole("option", { name: "Beavers" })).toBeVisible(); await expect(page.getByRole("option", { name: "Rovers" })).toBeVisible(); });
test("group leader copies a meeting into another authorised section and resets operational history", async ({ page }, testInfo) => {
  desktopOnly(testInfo); test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");
  await login(page, adminEmail!); await page.goto("/leader/weekly");
  const source=page.getByTestId(/meeting-history-/).filter({hasText:"· Scouts"}).first();
  await expect(source).toBeVisible();
  await source.getByRole("button",{name:"Copy Meeting",exact:true}).click();
  const destination=page.getByRole("combobox",{name:"Destination section"});
  await expect(destination).toHaveText("Scouts");
  await destination.click();
  await page.getByRole("option",{name:"Cubs",exact:true}).click();
  await page.getByLabel("Choose date").fill("2099-03-15");
  await page.getByRole("button",{name:"Create Copy",exact:true}).click();
  await expect(page.getByText(/Meeting copied\. Planner rows and planned equipment were retained/)).toBeVisible();
  await expect(page.getByTestId("weekly-meeting-editor-top")).toContainText("Cubs");
  await page.getByRole("button",{name:"Attendance",exact:true}).click();
  await expect(page.getByText(scoutMemberName)).toHaveCount(0);
  await expect(page.getByRole("checkbox", { name: dualSectionMember, exact: true })).toHaveCount(1);
  await page.getByRole("button",{name:"Completed Badgework",exact:true}).click();
  await expect(page.getByText("Pioneering Stage 2")).toHaveCount(0);
  await page.getByRole("button",{name:"Injuries / Medical",exact:true}).click();
  await expect(page.getByText(/Small graze during wide game/)).toHaveCount(0);
  await page.getByRole("button",{name:"Notes",exact:true}).click();
  await expect(page.getByLabel("Additional meeting notes")).toHaveValue("");
});




test("SW-264 Group Secretary does not gain Create Meeting action", async ({ page }, testInfo) => {
  desktopOnly(testInfo); test.skip(!password, "Configure canonical E2E password.");
  await login(page, "test.group.secretary@example.com"); await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Meeting History" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create Meeting", exact: true })).toHaveCount(0);
  const history=page.getByTestId(/meeting-history-/).filter({hasText:"· Scouts"}).first(); await history.getByRole("button",{name:"View",exact:true}).click();
  await expect(page.getByRole("button", { name: "Create Meeting", exact: true })).toHaveCount(0);
});


test("SW-264 mobile meeting editor exposes canonical Create Meeting route", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "SW-264 mobile navigation runs on the canonical mobile project.");
  test.skip(!password || !sectionLeaderEmail, "Configure canonical E2E section leader credentials.");
  await login(page, sectionLeaderEmail); await page.goto("/leader/weekly");
  const meeting = page.getByRole("button", { name: /· Scouts/ }).first();
  if (await meeting.count()) await meeting.click(); else { const history=page.getByTestId(/meeting-history-/).filter({hasText:"· Scouts"}).first(); await history.getByRole("button", { name: /View/ }).click(); }
  const create = page.getByRole("button", { name: "Create Meeting", exact: true });
  await expect(create).toBeVisible();
  await create.click();
  await expect(page).toHaveURL(/\/leader\/weekly\/create$/);
  await expect(page.getByRole("heading", { name: "Create Meeting" })).toBeVisible();
});

test("SW-322 Meeting History filters stay compact and usable on desktop and mobile", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Meeting History filter layout runs on desktop and Pixel 7 Chromium.");
  test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");

  await login(page, adminEmail!);
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Meeting History" })).toBeVisible();

  const historyCard = page.getByRole("heading", { name: "Meeting History" }).locator("xpath=..");
  const search = page.getByLabel("Search meeting history");
  const section = page.getByLabel("Meeting history section");
  const fromDate = page.getByLabel("From date");
  const toDate = page.getByLabel("To date");
  await expect(search).toBeVisible();
  await expect(section).toBeVisible();
  await expect(fromDate).toBeVisible();
  await expect(toDate).toBeVisible();

  const searchBounds = await search.boundingBox();
  const sectionBounds = await section.boundingBox();
  const viewportWidth = page.viewportSize()?.width ?? 0;
  const cardBounds = await historyCard.boundingBox();
  expect(searchBounds).not.toBeNull();
  expect(sectionBounds).not.toBeNull();
  expect(cardBounds).not.toBeNull();
  expect(viewportWidth).toBeGreaterThan(0);

  if (testInfo.project.name === "mobile-chromium") {
    expect(sectionBounds!.y - (searchBounds!.y + searchBounds!.height)).toBeLessThan(96);
  } else {
    expect(Math.abs(sectionBounds!.y - searchBounds!.y)).toBeLessThan(80);
  }

  const expectControlsInsideCard = async (controls: Locator[]) => {
    const bounds = await Promise.all(controls.map((control) => control.boundingBox()));
    for (const box of bounds) {
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(cardBounds!.x);
      expect(box!.x + box!.width).toBeLessThanOrEqual(cardBounds!.x + cardBounds!.width + 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
    }
  };
  await expectControlsInsideCard([search, section, fromDate, toDate]);

  await search.focus();
  await search.press("Tab");
  await expect(section).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(fromDate).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(toDate).toBeFocused();

  const resultCount = page.getByTestId("weekly-history-result-count");
  await search.fill("Scout Den");
  await expect(resultCount).toContainText(/Showing [1-9]\d* of \d+ closed meetings/);
  await search.fill("No matching meeting 900000");
  await expect(page.getByTestId("weekly-history-no-results")).toBeVisible();
  await search.fill("");

  await section.click();
  await page.getByRole("option", { name: "Beavers", exact: true }).click();
  await expect(page.locator('[data-testid^="meeting-history-"][data-section="Beavers"]').first()).toBeVisible();
  await expect(page.locator('[data-testid^="meeting-history-"][data-section="Rovers"]')).toHaveCount(0);
  await section.click();
  await page.getByRole("option", { name: "Cubs", exact: true }).click();
  await expect(page.locator('[data-testid^="meeting-history-"][data-section="Cubs"]').first()).toBeVisible();
  await expect(page.locator('[data-testid^="meeting-history-"][data-section="Beavers"]')).toHaveCount(0);

  await fromDate.fill("2100-01-01");
  await expect(page.getByTestId("weekly-history-no-results")).toBeVisible();
  await fromDate.fill("2099-01-01");
  await toDate.fill("2099-12-31");
  await expect(page.locator('[data-testid^="meeting-history-"][data-section="Cubs"]').first()).toBeVisible();
  const reset = page.getByTestId("weekly-history-reset");
  await expect(reset).toBeVisible();
  await expectControlsInsideCard([search, section, fromDate, toDate, reset]);
  await reset.click();

  await expect(search).toHaveValue("");
  await expect(section).toContainText("All sections");
  await expect(fromDate).toHaveValue("");
  await expect(toDate).toHaveValue("");
  await expect(reset).toHaveCount(0);
  await expect(page.locator('[data-testid^="meeting-history-"]')).not.toHaveCount(0);
});
