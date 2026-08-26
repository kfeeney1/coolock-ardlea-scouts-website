import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const lifecycleDate = "2099-03-01";
const copyDate = "2099-03-08";
const scoutMemberName = "Casey OBrien Scouts 01";
const scoutSectionLeader = "Scouts Section Leader · Section Leader";

function desktopOnly(testInfo: TestInfo) { test.skip(testInfo.project.name !== "chromium", "Weekly meeting lifecycle runs once on desktop Chromium."); }
async function login(page: Page, email: string) { await page.goto("/leader/login"); await page.getByLabel("Email address").fill(email); await page.getByLabel("Password").fill(password!); await page.getByRole("button", { name: "Sign In" }).click(); await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible(); }

async function openOrCreateLifecycleMeeting(page: Page) {
  const existing = page.getByRole("button", { name: /1 Mar 2099 · Scouts/ });
  if (await existing.count()) { await existing.first().click(); return false; }
  const closed = page.getByTestId(/meeting-history-/).filter({ hasText: "1 Mar 2099 · Scouts" });
  if (await closed.count()) { await closed.first().getByRole("button", { name: "View / Edit" }).click(); if (await page.getByRole("button", { name: "Reopen Meeting" }).count()) await page.getByRole("button", { name: "Reopen Meeting" }).click(); return false; }
  await page.getByLabel("Meeting date").fill(lifecycleDate); await page.getByRole("button", { name: "Create Meeting" }).click(); await expect(page.getByText(/Meeting created with 2 activity\/game rows and 1 badgework row\./)).toBeVisible(); return true;
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

test("weekly meetings reject unauthenticated users", async ({ page }) => { await page.goto("/leader/weekly"); await expect(page).toHaveURL(/\/leader\/login$/); });

test("section leader completes lifecycle with flexible planner rows and copy", async ({ page }, testInfo) => {
  desktopOnly(testInfo); test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await login(page, leaderEmail!); await page.goto("/leader/weekly"); await expect(page.getByRole("heading", { name: "Weekly Meetings" })).toBeVisible(); await expect(page.getByLabel("Section")).toHaveText(/Scouts/);
  const created = await openOrCreateLifecycleMeeting(page);

  await page.getByRole("button", { name: "Attendance", exact: true }).click(); await page.getByRole("button", { name: "Mark all present", exact: true }).click(); await expect(page.getByText(/30\/30 Present/)).toBeVisible(); await expect(page.getByRole("checkbox", { name: scoutMemberName })).toBeChecked();

  await page.getByRole("button", { name: "Programme", exact: true }).click();
  if (created) await expect(page.getByTestId("activity-plan-row")).toHaveCount(2);
  await normalizePlanner(page);
  await page.getByLabel("Theme").fill("Navigation Night"); await page.getByLabel("Location").fill("Scout Den");
  await page.getByLabel("Activity 1", { exact: true }).fill("Wide game"); await firstActivityLeader(page).check(); await page.getByLabel("Equipment 1", { exact: true }).fill("Cones and maps"); await page.getByLabel("Activity duration (minutes) 1", { exact: true }).fill("25"); await page.getByLabel("Instructions / notes 1", { exact: true }).fill("Patrol navigation challenge");
  await page.getByLabel("Activity 2", { exact: true }).fill("Pioneering relay"); await page.getByLabel("Activity duration (minutes) 2", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Add activity / game", exact: true }).click(); await expect(page.getByTestId("activity-plan-row")).toHaveCount(3); await page.getByTestId("activity-plan-row").last().getByRole("button", { name: "Remove" }).click(); await expect(page.getByTestId("activity-plan-row")).toHaveCount(2); await page.getByRole("button", { name: "Add activity / game", exact: true }).click(); await page.getByLabel("Activity 3", { exact: true }).fill("Closing game"); await page.getByLabel("Activity duration (minutes) 3", { exact: true }).fill("10"); await page.getByLabel("Programme notes").fill("Reusable opening and patrol rotation.");

  if (created) await expect(page.getByTestId("badgework-plan-row")).toHaveCount(1);
  const badgework1=page.getByTestId("badgework-plan-row").first(); await badgework1.getByLabel("Badgework 1", { exact: true }).fill("Adventure Skills: Pioneering"); await firstBadgeworkLeader(page).check(); await badgework1.getByLabel("Badgework equipment 1", { exact: true }).fill("Rope and pioneering poles"); await badgework1.getByLabel("Badgework duration (minutes) 1", { exact: true }).fill("40"); await badgework1.getByLabel("Badgework instructions / notes 1", { exact: true }).fill("Stage 2 lashings");
  await page.getByRole("button", { name: "Add badgework", exact: true }).click(); await expect(page.getByTestId("badgework-plan-row")).toHaveCount(2); await page.getByTestId("badgework-plan-row").last().getByRole("button", { name: "Remove" }).click(); await expect(page.getByTestId("badgework-plan-row")).toHaveCount(1); await page.getByRole("button", { name: "Add badgework", exact: true }).click(); await page.getByLabel("Badgework 2", { exact: true }).fill("Teamwork"); await page.getByLabel("Badgework duration (minutes) 2", { exact: true }).fill("10");
  await expect(page.getByTestId("programme-duration-total")).toHaveText("Planned programme: 105 minutes"); await expect(page.getByTestId("programme-duration-warning")).toContainText("15 minutes longer than the standard 1½-hour meeting");

  await page.getByRole("button", { name: "Completed Badgework", exact: true }).click();
  await page.getByLabel(`Badges · ${scoutMemberName}`).fill("Pioneering Stage 2");

  await page.getByRole("button", { name: "Injuries / Medical", exact: true }).click(); if (!await page.getByText(/Small graze during wide game/).count()) { await page.getByLabel("Member").click(); await page.getByRole("option", { name: scoutMemberName }).click(); await page.getByLabel("Injury / medical concern").fill("Small graze during wide game"); await page.getByLabel("Severity").click(); await page.getByRole("option", { name: "Minor" }).click(); await page.getByLabel("Action taken").fill("Cleaned and covered"); await page.getByRole("checkbox", { name: "Parent informed" }).check(); await page.getByRole("button", { name: "Add Incident", exact: true }).click(); } await expect(page.getByText(/Small graze during wide game/)).toBeVisible();
  await page.getByRole("button", { name: "Notes", exact: true }).click(); await page.getByLabel("Additional meeting notes").fill("Visitors and equipment issue recorded after meeting."); await page.getByRole("button", { name: "Save Meeting", exact: true }).click(); await expect(page.getByText("Meeting saved.")).toBeVisible();

  await expect(page.getByRole("heading", { name: "Create Meeting" })).toBeVisible();
  await page.getByRole("button", { name: /1 Mar 2099 · Scouts/ }).first().click();
  await page.getByRole("button", { name: "Programme", exact: true }).click(); await expect(page.getByTestId("activity-plan-row")).toHaveCount(3); await expect(page.getByLabel("Activity 1", { exact: true })).toHaveValue("Wide game"); await expect(firstActivityLeader(page)).toBeChecked(); await expect(page.getByLabel("Activity duration (minutes) 1", { exact: true })).toHaveValue("25"); await expect(page.getByTestId("badgework-plan-row")).toHaveCount(2); await expect(page.getByLabel("Badgework 2", { exact: true })).toHaveValue("Teamwork"); await expect(firstBadgeworkLeader(page)).toBeChecked(); await expect(page.getByLabel("Badgework equipment 1", { exact: true })).toHaveValue("Rope and pioneering poles"); await expect(page.getByLabel("Badgework duration (minutes) 1", { exact: true })).toHaveValue("40"); await expect(page.getByTestId("programme-duration-warning")).toBeVisible();

  await page.getByRole("button", { name: "Close Meeting", exact: true }).click(); await expect(page.getByText("Meeting closed and added to history.")).toBeVisible(); await page.getByRole("button", { name: "Meetings", exact: true }).click(); const historyCard = page.getByTestId(/meeting-history-/).filter({ hasText: "1 Mar 2099 · Scouts" }); await expect(historyCard).toContainText("3 activities · 2 badgework"); await historyCard.getByRole("button", { name: "View / Edit", exact: true }).click(); await page.getByRole("button", { name: "Reopen Meeting", exact: true }).click(); await expect(page.getByText("Meeting reopened.")).toBeVisible(); await page.getByRole("button", { name: "Close Meeting", exact: true }).click(); await expect(page.getByText("Meeting closed and added to history.")).toBeVisible();

  await page.getByRole("button", { name: "Meetings", exact: true }).click(); const priorCopy = page.getByRole("button", { name: /8 Mar 2099 · Scouts/ }); if (await priorCopy.count()) { await priorCopy.first().click(); } else { const closedCard=page.getByTestId(/meeting-history-/).filter({hasText:"1 Mar 2099 · Scouts"}); await closedCard.getByRole("button",{name:"Copy Meeting", exact:true}).click(); await page.getByLabel("Choose date").fill(copyDate); await page.getByRole("button",{name:"Create Copy", exact:true}).click(); await expect(page.getByText(/Meeting copied\. Planner rows were retained/)).toBeVisible(); }
  await page.getByRole("button", { name: "Attendance", exact: true }).click(); await expect(page.getByText(/0\/30 Present/)).toBeVisible();
  await page.getByRole("button", { name: "Programme", exact: true }).click(); await expect(page.getByLabel("Theme")).toHaveValue("Navigation Night"); await expect(page.getByTestId("activity-plan-row")).toHaveCount(3); await expect(page.getByLabel("Activity 1", { exact: true })).toHaveValue("Wide game"); await expect(firstActivityLeader(page)).toBeChecked(); await expect(page.getByLabel("Equipment 1", { exact: true })).toHaveValue("Cones and maps"); await expect(page.getByLabel("Activity duration (minutes) 1", { exact: true })).toHaveValue("25"); await expect(page.getByTestId("badgework-plan-row")).toHaveCount(2); await expect(page.getByLabel("Badgework 1", { exact: true })).toHaveValue("Adventure Skills: Pioneering"); await expect(firstBadgeworkLeader(page)).toBeChecked(); await expect(page.getByLabel("Badgework duration (minutes) 1", { exact: true })).toHaveValue("40"); await expect(page.getByTestId("programme-duration-total")).toHaveText("Planned programme: 105 minutes");
  await page.getByRole("button", { name: "Completed Badgework", exact: true }).click(); await expect(page.getByLabel(`Badges · ${scoutMemberName}`)).toHaveCount(0);
  await page.getByRole("button", { name: "Injuries / Medical", exact: true }).click(); await expect(page.getByText(/Small graze during wide game/)).toHaveCount(0); await page.getByRole("button", { name: "Notes", exact: true }).click(); await expect(page.getByLabel("Additional meeting notes")).toHaveValue("");
});

test("seeded meeting history is stable and varied for every section", async ({ page }, testInfo) => { desktopOnly(testInfo); test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials."); await login(page, adminEmail!); await page.goto("/leader/weekly"); await expect(page.getByRole("heading", { name: "Meeting History" })).toBeVisible(); for (const section of ["Beavers","Cubs","Scouts","Ventures","Rovers"]) await expect(page.getByText(new RegExp(`· ${section}$`)).first()).toBeVisible(); await expect(page.getByText(/1 activities · 1 badgework/).first()).toBeVisible(); await expect(page.getByText(/3 activities · 1 badgework/).first()).toBeVisible(); await expect(page.getByText(/1 activities · 3 badgework/).first()).toBeVisible(); });
test("group leader can create meetings across sections", async ({ page }, testInfo) => { desktopOnly(testInfo); test.skip(!password, "Configure canonical E2E password."); await login(page, "test.group.leader@example.com"); await page.goto("/leader/weekly"); await page.getByLabel("Section").click(); await expect(page.getByRole("option", { name: "Beavers" })).toBeVisible(); await expect(page.getByRole("option", { name: "Rovers" })).toBeVisible(); });
test("group secretary can view all meeting history but cannot edit", async ({ page }, testInfo) => { desktopOnly(testInfo); test.skip(!password, "Configure canonical E2E password."); await login(page, "test.group.secretary@example.com"); await page.goto("/leader/weekly"); await expect(page.getByRole("heading", { name: "Create Meeting" })).toHaveCount(0); await expect(page.getByRole("heading", { name: "Meeting History" })).toBeVisible(); await expect(page.getByText(/· Beavers$/).first()).toBeVisible(); await expect(page.getByText(/· Rovers$/).first()).toBeVisible(); });
