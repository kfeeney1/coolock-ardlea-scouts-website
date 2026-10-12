import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const sectionLeaderEmail = process.env.E2E_SECTION_LEADER_EMAIL || "test.scout.section.leader@example.com";
const scoutMemberName = "Casey OBrien Scouts 01";
const dualSectionMember = "TEST Dual Section Member";

function desktopOnly(testInfo: TestInfo) { test.skip(testInfo.project.name !== "chromium", "Weekly meeting permissions and history run once on desktop Chromium."); }
async function login(page: Page, email: string) { await page.goto("/leader/login"); await page.getByLabel("Email address").fill(email); await page.getByLabel("Password").fill(password!); await page.getByRole("button", { name: "Sign In" }).click(); await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible(); }

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
  await expect(page.getByRole("checkbox", { name: `Attendance · ${dualSectionMember}`, exact: true })).toHaveCount(1);
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
