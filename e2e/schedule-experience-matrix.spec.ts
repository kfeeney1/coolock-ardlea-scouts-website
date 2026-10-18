import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { clearScheduleEvents, clearScheduleMeetings, scheduleEventIds, scheduleFixtureDb, scheduleMeetingIds, seedScheduleEvents, seedScheduleMeetings } from "./support/schedule-fixtures";
const password = process.env.E2E_TEST_USER_PASSWORD;
async function setting(page: Page, kind: string, redesigned: boolean) {
  const button = page.getByRole("button", { name: `${redesigned ? "Redesigned" : "Existing"} ${kind}`, exact: true });
  await expect(button).toBeEnabled();
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}
for (const navigation of [false, true]) for (const schedules of [false, true]) test(`Navigation ${navigation}, schedules ${schedules}: list identity and canonical data`, async ({ page }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  await seedScheduleMeetings(); await seedScheduleEvents();
  const db = scheduleFixtureDb();
  const refs = [...scheduleMeetingIds.map(id => db.doc(`weeklyMeetings/${id}`)), ...scheduleEventIds.map(id => db.doc(`events/${id}`))];
  const before = await Promise.all(refs.map(async ref => (await ref.get()).data()));
  try {
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    {
      await page.goto("/leader/settings");
      await setting(page, "navigation", navigation); await setting(page, "schedules", schedules);
      await page.reload();
      await expect(page.getByRole("button", { name: `${navigation ? "Redesigned" : "Existing"} navigation`, exact: true })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("button", { name: `${schedules ? "Redesigned" : "Existing"} schedules`, exact: true })).toHaveAttribute("aria-pressed", "true");
      for (const [path, label, heading] of [["weekly", "Meetings", "Weekly Meetings"], ["events", "Events", "Events & Activities"]]) {
        await page.goto(`/leader/${path}`);
        await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
        const schedule = page.getByRole("region", { name: `${label} schedule`, exact: true });
        if (schedules) await expect(schedule).toBeVisible(); else await expect(schedule).toHaveCount(0);
        await expect(page.getByTestId("leader-dashboard-header")).toBeVisible();
        if (path === "events" && schedules) {
          await page.getByLabel("Search events", { exact: true }).fill("No schedule fixture can match this text");
          await expect(page.getByText("No Events match the current filters.", { exact: true })).toBeVisible();
        }
      }
    }
    const after = await Promise.all(refs.map(async ref => (await ref.get()).data()));
    expect(after).toEqual(before);
  } finally {
    await page.goto("/leader/settings"); await setting(page, "navigation", false); await setting(page, "schedules", false);
    await clearScheduleMeetings(); await clearScheduleEvents();
  }
});

test("Read-only meeting access and section boundaries survive redesigned schedules", async ({ page, browser, baseURL }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  await seedScheduleMeetings();
  const db = scheduleFixtureDb();
  await db.doc("siteSettings/scheduleExperience").set({ version: "redesigned" });
  await db.doc("weeklyMeetings/000-sw177-private-beavers").set({ section: "Beavers", meetingDate: "2099-01-01", status: "open", theme: "Private Beavers fixture", entries: [], notes: "", activities: [], badgeworkPlan: [] });
  try {
    await loginAsLeader(page, { email: "test.group.secretary@example.com", password: password! });
    await page.goto("/leader/weekly");
    const schedule = page.getByRole("region", { name: "Meetings schedule", exact: true });
    await expect(schedule).toBeVisible();
    await expect(schedule.getByRole("link", { name: "Edit meeting", exact: true })).toHaveCount(0);
    await expect(schedule.getByRole("link", { name: "Copy meeting", exact: true })).toHaveCount(0);
    await page.goto("/leader/settings");
    await expect(page.getByRole("button", { name: "Redesigned schedules", exact: true })).toHaveCount(0);
    const context = await browser.newContext({ baseURL });
    try {
      const scoped = await context.newPage();
      await loginAsLeader(scoped, { email: "test.scout.programme.scouter@example.com", password: password! });
      await scoped.goto("/leader/weekly");
      await expect(scoped.getByRole("region", { name: "Meetings schedule", exact: true })).toBeVisible();
      await expect(scoped.getByText("Private Beavers fixture", { exact: false })).toHaveCount(0);
      await scoped.goto("/leader/weekly?meeting=000-sw177-private-beavers");
      await expect(scoped.getByTestId("page-weekly-meetings")).toBeVisible();
      await expect(scoped.getByText("Private Beavers fixture", { exact: false })).toHaveCount(0);
    } finally { await context.close(); }
  } finally { await db.doc("weeklyMeetings/000-sw177-private-beavers").delete(); await clearScheduleMeetings(); }
});

test("Touch swipe and pointer browsing keep the event tile and date in sync", async ({ page, context }, testInfo) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  await seedScheduleEvents();
  try {
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto("/leader/settings"); await setting(page, "schedules", true);
    await page.goto("/leader/events");
    await page.getByLabel("Search events", { exact: true }).fill("Schedule event");
    const schedule = page.getByRole("region", { name: "Events schedule", exact: true });
    await expect(schedule.getByRole("article", { name: "Schedule event 1", exact: true })).toHaveAttribute("aria-current", "true");
    const browse = schedule.getByLabel("Browse Events; use Left and Right arrow keys", { exact: true });
    await browse.scrollIntoViewIfNeeded();
    const box = (await browse.boundingBox())!;
    const viewport = page.viewportSize()!;
    const y = (Math.max(0, box.y) + Math.min(viewport.height, box.y + box.height)) / 2;
    const x = box.x + box.width * 0.8;
    if (testInfo.project.name === "mobile-chromium") {
      const client = await context.newCDPSession(page);
      await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let step = 1; step <= 6; step++) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x - box.width * 0.65 * step / 6, y }] });
      await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      await client.detach();
    } else {
      await page.mouse.move(x, y); await page.mouse.wheel(box.width * 0.8, 0);
    }
    await expect(schedule.getByRole("article", { name: "Schedule event 2", exact: true })).toHaveAttribute("aria-current", "true");
    const future = (await scheduleFixtureDb().doc("events/000-sw177-event-future").get()).get("startDate") as string;
    await expect(schedule.getByLabel("Events date", { exact: true })).toHaveValue(future.split("-").reverse().join("-"));
    await schedule.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(schedule.getByRole("article", { name: "Schedule event 1", exact: true })).toHaveAttribute("aria-current", "true");
  } finally { await clearScheduleEvents(); }
});
