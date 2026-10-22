import {expect, test} from "@playwright/test";
import {scheduleFixtureDb} from "./support/schedule-fixtures";
import {loginAsLeader} from "./support/authentication-helpers";
import {scheduleToday} from "../src/services/scheduleSelection";
for (const uiTheme of ["default", "modern"]) test(`Calendar record pages share compact page identity and usable controls (${uiTheme})`, async ({page}, testInfo) => {
  test.setTimeout(45000);
  test.skip(!process.env.E2E_TEST_USER_PASSWORD, "Configure canonical E2E credentials.");
  const db = scheduleFixtureDb(), taskId = "sw529-calendar-task-layout-001", appointmentId = "sw529-calendar-service-layout-001", eventId = "sw529-calendar-public-layout-001";
  const paths = ["siteSettings/calendarExperience", "siteSettings/maintenanceExperience", "adminUsers/TEST_uid_super_admin_01", `maintenance/group/tasks/${taskId}`, `maintenance/group/appointments/${appointmentId}`, `publicEvents/${eventId}`];
  const previous = await Promise.all(paths.map(path => db.doc(path).get()));
  const date = scheduleToday();
  try {
    await db.doc(paths[0]).set({version: "redesigned"}); await db.doc(paths[1]).set({version: "redesigned", sdkRevision: 1}); await db.doc(paths[2]).update({uiTheme});
    await db.doc(paths[3]).set({description: "Inspect the den entrance and its hinges", documentIds: [], status: "open", assigneeUid: "TEST_uid_super_admin_01", assigneeName: "Responsible leader", revision: 1, createdAt: Date.now()});
    await db.doc(paths[4]).set({title: "Annual boiler service", date, allDay: true, startTime: "", endTime: "", location: "Scout den", notes: "Service notes. ".repeat(100), revision: 1});
    await db.doc(paths[5]).set({eventId, eventType: "Activity", title: "Shared group event", section: "Group", startDate: date, endDate: date, description: "Event programme details. ".repeat(100)});
    await loginAsLeader(page, {email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: process.env.E2E_TEST_USER_PASSWORD!});
    const check = async (route: string, title: string) => {
      await page.goto(route);
      await expect(page.getByRole("heading", {name: title, exact: true, level: 1})).toBeVisible();
      await expect(page.getByText("Leader Dashboard", {exact: true})).toHaveCount(0);
      const back = page.getByRole("link", {name: "Back to calendar", exact: true});
      const box = await back.boundingBox(); expect(box?.width).toBeGreaterThanOrEqual(44); expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    };
    await check("/calendar/maintenance/new", "Maintenance appointment");
    await expect(page.locator("html")).toHaveAttribute("data-ui-theme", uiTheme);
    const save = page.getByRole("button", {name: "Save appointment", exact: true});
    await expect(save).toBeVisible(); await save.focus(); await expect(save).toBeFocused();
    await page.screenshot({path: testInfo.outputPath("calendar-appointment-editor.png"), fullPage: true});
    await check(`/calendar/maintenance/${appointmentId}`, "Maintenance appointment");
    await expect(page.getByRole("heading", {name: "Annual boiler service", exact: true})).toBeVisible();
    await expect(page.getByRole("button", {name: "Show more", exact: true})).toBeVisible();
    await page.getByRole("link", {name: "Edit appointment", exact: true}).click(); await expect(save).toBeVisible();
    await check("/calendar/maintenance/tasks", "Schedule maintenance task");
    await page.getByRole("link", {name: /Schedule task: Inspect the den entrance/}).click();
    await expect(page.getByText("Responsible leader: Responsible leader · Open", {exact: true})).toBeVisible();
    await expect(page.getByRole("textbox", {name: /Appointment title/})).toHaveCount(0);
    await page.screenshot({path: testInfo.outputPath("calendar-task-editor.png"), fullPage: true});
    await check(`/calendar/source/publicEvents/${eventId}`, "Event programme");
    await expect(page.getByRole("heading", {name: "Shared group event", exact: true})).toBeVisible();
    await page.screenshot({path: testInfo.outputPath("calendar-programme-detail.png"), fullPage: true});
  } finally {
    const batch = db.batch(); previous.forEach(snapshot => snapshot.exists ? batch.set(snapshot.ref, snapshot.data()!) : batch.delete(snapshot.ref)); await batch.commit();
  }
});
