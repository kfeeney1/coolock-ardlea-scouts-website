import {expect, test} from "@playwright/test";
import {scheduleFixtureDb} from "./support/schedule-fixtures";
import {loginAsLeader} from "./support/authentication-helpers";
import {reconcileOpenWeeklyRoster} from "../src/services/weeklyTrackerLogic";
import {handleHallBookingRoute} from "../email-worker/src/hallBookingRoutes.js";
import {hallSourceIdentity} from "../email-worker/src/hallSourceReservation.js";
const password = process.env.E2E_TEST_USER_PASSWORD, id = "hall-meeting-browser-001", date = "2099-11-05";
const paths = ["siteSettings/hallHire", "siteSettings/hallHirePublic", "siteSettings/hallHireReadiness", "hall/group", `weeklyMeetings/${id}`, `parentWeeklyMeetings/${id}`, `hall/group/days/${date}`, `hallAvailability/${date}`, "siteSettings/meetingExperience"];
let snapshots: FirebaseFirestore.DocumentSnapshot[] = [];
test.beforeEach(async () => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const db = scheduleFixtureDb(); snapshots = await Promise.all(paths.map(path => db.doc(path).get()));
  await db.doc(paths[0]).set({enabled: true}); await db.doc(paths[1]).set({enabled: true}); await db.doc(paths[2]).set({ready: true}); await db.doc(paths[3]).set({ready: true, revision: 0}); await db.doc(paths[8]).set({version: "redesigned"});
  const members = (await db.collection("members").get()).docs.map(item => ({id: item.id, ...item.data()}));
  const entries = reconcileOpenWeeklyRoster([], members as Parameters<typeof reconcileOpenWeeklyRoster>[1], "Cubs");
  await db.doc(paths[4]).set({section: "Cubs", meetingDate: date, status: "open", location: "Synthetic", plannedActivities: "", plannedBadgework: "", programmeNotes: "", notes: "PRIVATE programme retained", entries, injuries: [], testData: true});
  await db.doc(paths[5]).set({section: "Cubs", meetingDate: date, status: "open", location: "Published", theme: "Published", activities: [], badgework: []});
});
test.afterEach(async () => {
  if (!snapshots.length) return;
  const db = scheduleFixtureDb(), {bookingId} = await hallSourceIdentity("meeting", id);
  await db.recursiveDelete(db.doc(`hall/group/bookings/${bookingId}`));
  for (const audit of (await db.collection("auditLog").where("targetId", "==", bookingId).get()).docs) await audit.ref.delete();
  for (const item of (await db.collection(`weeklyMeetings/${id}/leaderAttendance`).get()).docs) await item.ref.delete();
  for (let index = 0; index < paths.length; index++) {if (snapshots[index].exists) await db.doc(paths[index]).set(snapshots[index].data()!); else await db.doc(paths[index]).delete();}
  snapshots = [];
});
test("scoped Council meeting hall use preserves programme, handles off-state drafts, conflicts and release", async ({page}, testInfo) => {
  const db = scheduleFixtureDb();
  // Actual handler, identity verification and emulator writes; no save results stubbed.
  await page.route("**/hall-bookings", async route => {
    const response = await handleHallBookingRoute(new Request(route.request().url(), {method: route.request().method(), headers: route.request().headers(), ...(route.request().method() === "POST" ? {body: route.request().postData()!} : {})}), {FIREBASE_PROJECT_ID: "demo-coolock-ardlea-scouts", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", ALLOWED_ORIGINS: "http://127.0.0.1:4173"}, async () => "owner");
    await route.fulfill({status: response.status, headers: Object.fromEntries(response.headers), body: await response.text()});
  });
  await loginAsLeader(page, {email: "test.cub.section.leader@example.com", password: password!});
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({width: 320, height: 800});
  await page.goto(`/leader/weekly?meeting=${id}`);
  const panel = page.getByTestId("meeting-hall-use");
  await expect(panel.getByRole("button", {name: "Reserve Group hall", exact: true})).toBeEnabled();
  await panel.getByLabel("Hall start time", {exact: true}).fill("19:00");
  await db.doc(paths[1]).set({enabled: false});
  await expect(panel.getByRole("button", {name: "Reserve Group hall", exact: true})).toBeDisabled();
  await expect(panel.getByLabel("Hall start time", {exact: true})).toHaveValue("19:00");
  await panel.getByRole("button", {name: "Discard hall edits", exact: true}).click(); await expect(panel).toHaveCount(0);
  await db.doc(paths[1]).set({enabled: true});
  const start = panel.getByLabel("Hall start time", {exact: true}), end = panel.getByLabel("Hall end time", {exact: true});
  await start.focus(); await expect(start).toBeFocused(); await start.fill("19:00"); await end.fill("20:00");
  await panel.getByRole("button", {name: "Reserve Group hall", exact: true}).click();
  await expect(panel.getByText("This meeting reserves the Group hall.", {exact: true})).toBeVisible();
  expect((await db.doc(paths[7]).get()).get("occupied")).toHaveLength(1);
  expect((await db.doc(paths[4]).get()).get("notes")).toBe("PRIVATE programme retained");
  // Successful in-place save consumes the draft guard's Back entry.
  await page.goBack(); await expect(page).toHaveURL(/\/leader$/);
  await page.goto(`/leader/weekly?meeting=${id}`);
  await expect(panel.getByText("This meeting reserves the Group hall.", {exact: true})).toBeVisible();
  const bucket = db.doc(paths[6]), before = (await bucket.get()).data()!;
  await bucket.set({reservations: [...before.reservations, {bookingId: "competing", start: Date.parse(`${date}T20:00:00Z`), end: Date.parse(`${date}T21:00:00Z`)}]});
  await end.fill("21:00"); await panel.getByRole("button", {name: "Save hall schedule", exact: true}).click();
  await expect(panel.getByRole("alert").filter({hasText: "Your edits are retained"})).toBeVisible(); await expect(end).toHaveValue("21:00");
  expect((await db.doc(paths[4]).get()).get("hallEndTime")).toBe("20:00"); await bucket.set(before);
  await panel.getByRole("button", {name: "Discard hall edits", exact: true}).click();
  await panel.getByRole("button", {name: "Release hall", exact: true}).click();
  const confirmation = page.getByRole("dialog", {name: "Release this meeting’s hall time?", exact: true});
  await expect(confirmation.getByRole("button", {name: "Keep reservation", exact: true})).toBeFocused();
  await confirmation.getByRole("button", {name: "Confirm release", exact: true}).click();
  await expect(panel.getByRole("button", {name: "Reserve Group hall", exact: true})).toBeEnabled();
  expect((await db.doc(paths[7]).get()).get("occupied")).toEqual([]);
  expect((await db.doc(paths[4]).get()).get("notes")).toBe("PRIVATE programme retained");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
