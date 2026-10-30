import {expect, test} from "@playwright/test";
import {getApps} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {loginAsLeader} from "./support/authentication-helpers";
import {scheduleFixtureDb} from "./support/schedule-fixtures";
import {handleHallBookingRoute} from "../email-worker/src/hallBookingRoutes.js";
import {hallSourceIdentity} from "../email-worker/src/hallSourceReservation.js";
const password = process.env.E2E_TEST_USER_PASSWORD;
const id = "hall-maintenance-browser-001", day = "2099-11-05";
const paths = ["siteSettings/calendarExperience", "siteSettings/maintenanceExperience", "siteSettings/hallHire", "siteSettings/hallHirePublic", "siteSettings/hallHireReadiness", "hall/group", `maintenance/group/appointments/${id}`, `hall/group/days/${day}`, `hallAvailability/${day}`];
let snapshots: FirebaseFirestore.DocumentSnapshot[] = [];
test.beforeEach(async () => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const db = scheduleFixtureDb(); snapshots = await Promise.all(paths.map(path => db.doc(path).get()));
  for (const path of paths.slice(0, 2)) await db.doc(path).set({version: "redesigned", sdkRevision: 1});
  await db.doc(paths[2]).set({enabled: true}); await db.doc(paths[3]).set({enabled: true}); await db.doc(paths[4]).set({ready: true}); await db.doc(paths[5]).set({ready: true, revision: 0});
});
test.afterEach(async () => {
  if (!snapshots.length) return;
  const db = scheduleFixtureDb(), {bookingId} = await hallSourceIdentity("maintenance", id);
  await db.recursiveDelete(db.doc(`hall/group/bookings/${bookingId}`));
  for (const audit of (await db.collection("auditLog").where("targetId", "==", bookingId).get()).docs) await audit.ref.delete();
  for (let index = 0; index < paths.length; index++) {if (snapshots[index].exists) await db.doc(paths[index]).set(snapshots[index].data()!); else await db.doc(paths[index]).delete();}
  snapshots = [];
});
test("Council hall maintenance uses real authoritative save, retains conflicts and cancels at 320px", async ({page}, testInfo) => {
  const db = scheduleFixtureDb(), auth = getAuth(getApps().find(app => app.name === "schedule-fixtures")!);
  const user = await auth.getUserByEmail("test.cub.section.leader@example.com");
  await db.doc(`maintenance/group/access/${user.uid}`).set({kind: "leader", sourceId: user.uid});
  await db.doc(paths[6]).set({title: "Hall maintenance browser", date: day, allDay: false, startTime: "19:00", endTime: "20:00", location: "Synthetic", notes: "Private maintenance details", revision: 1, createdBy: user.uid, updatedBy: user.uid, createdAt: new Date(), updatedAt: new Date()});
  const commands: Record<string, unknown>[] = [];
  // Forward browser transport to the real handler and Firestore emulator; no
  // permission, reservation, conflict or persistence responses are stubbed.
  await page.route("**/hall-bookings", async route => {
    if (route.request().method() === "POST") commands.push(route.request().postDataJSON());
    const response = await handleHallBookingRoute(new Request(route.request().url(), {method: route.request().method(), headers: route.request().headers(), ...(route.request().method() === "POST" ? {body: route.request().postData()!} : {})}), {FIREBASE_PROJECT_ID: "demo-coolock-ardlea-scouts", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", ALLOWED_ORIGINS: "http://127.0.0.1:4173"}, async () => "owner");
    await route.fulfill({status: response.status, headers: Object.fromEntries(response.headers), body: await response.text()});
  });
  await loginAsLeader(page, {email: user.email!, password: password!});
  if (testInfo.project.name === "mobile-chromium") await page.setViewportSize({width: 320, height: 800});
  await page.goto(`/calendar/maintenance/${id}/edit`);
  const hall = page.getByRole("checkbox", {name: "Occupies Group hall", exact: true});
  // Reversing a tentative hall choice must preserve ordinary SDK scheduling.
  await hall.check(); await hall.uncheck();
  await page.getByRole("button", {name: "Save appointment", exact: true}).click();
  await expect(page).toHaveURL(/\/calendar\?/);
  expect((await db.doc(paths[6]).get()).get("hallResource")).toBeUndefined();
  expect(commands).toHaveLength(0);
  await page.goto(`/calendar/maintenance/${id}/edit`);
  await hall.focus(); await expect(hall).toBeFocused(); await page.keyboard.press("Space"); await expect(hall).toBeChecked();
  await page.getByRole("button", {name: "Save appointment", exact: true}).click();
  await expect(page).toHaveURL(/\/calendar\?/);
  expect((await db.doc(paths[6]).get()).get("hallResource")).toBe("group-hall");
  expect((await db.doc(paths[8]).get()).get("occupied")).toHaveLength(1);
  await page.goto(`/calendar/maintenance/${id}/edit`);
  // A real competing reservation index makes the requested extension conflict.
  const bucket = db.doc(paths[7]), prior = (await bucket.get()).data()!;
  await bucket.set({reservations: [...prior.reservations, {bookingId: "competing", start: Date.parse(`${day}T20:00:00Z`), end: Date.parse(`${day}T21:00:00Z`)}]});
  await page.getByLabel(/^End time/).fill("21:00"); await page.getByRole("button", {name: "Save appointment", exact: true}).click();
  await expect(page.getByRole("alert").filter({hasText: "Your edits are retained"})).toBeVisible(); await expect(page.getByLabel(/^End time/)).toHaveValue("21:00");
  expect((await db.doc(paths[6]).get()).get("endTime")).toBe("20:00"); await bucket.set(prior);
  await page.getByLabel(/^End time/).fill("20:00");
  await page.goto(`/calendar/maintenance/${id}`);
  await page.getByRole("button", {name: "Cancel hall appointment", exact: true}).click();
  const confirmation = page.getByRole("dialog", {name: "Cancel hall appointment?", exact: true});
  await expect(confirmation.getByRole("button", {name: "Keep appointment", exact: true})).toBeFocused();
  await confirmation.getByRole("button", {name: "Confirm cancellation", exact: true}).click();
  await expect(page.getByRole("alert").filter({hasText: "Cancelled appointment"})).toBeVisible();
  expect((await db.doc(paths[8]).get()).get("occupied")).toEqual([]);
  expect(commands.some(value => value.action === "maintenance-cancel")).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
