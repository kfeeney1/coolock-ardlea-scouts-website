import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { waitForTransientOverlayHistory } from "./helpers/transientOverlayHistory";
import { reconcileOpenWeeklyRoster } from "../src/services/weeklyTrackerLogic";
const id = "000-sw424-lifecycle";
const password = process.env.E2E_TEST_USER_PASSWORD;
const copies: string[] = [];
async function login(page: Page) { await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! }); }
async function enter(page: Page) { await login(page); await page.goto(`/leader/weekly?meeting=${id}`); }
const closeDialog = (page: Page) => page.getByRole("dialog", { name: "Save & close meeting?", exact: true });
test.beforeEach(async () => {
  test.skip(!password, "Configure canonical E2E credentials."); const db = scheduleFixtureDb(); await db.doc("siteSettings/meetingExperience").set({ version: "redesigned" });
  const members = (await db.collection("members").get()).docs.map(doc => ({ id: doc.id, ...doc.data() })); const entries = reconcileOpenWeeklyRoster([], members as Parameters<typeof reconcileOpenWeeklyRoster>[1], "Scouts");
  await db.doc(`weeklyMeetings/${id}`).set({ section: "Scouts", meetingDate: "2099-07-22", status: "open", location: "Synthetic den", theme: "Stale legacy theme", activities: [{ id: "one", activity: "Stale legacy game", durationMinutes: 10 }], badgeworkPlan: [{ id: "legacy-badge", badge: "Legacy retained badge", durationMinutes: 10 }], programmeNotes: JSON.stringify({ marker: "weekly-programme-v1", theme: "Canonical theme", notes: "Canonical programme notes" }), plannedActivities: JSON.stringify({ marker: "weekly-activities-v1", items: [{ id: "one", activity: "Canonical game", leader: "Guest leader", equipment: "Cones", notes: "Canonical instructions", durationMinutes: 20 }] }), plannedBadgework: JSON.stringify({ marker: "weekly-badgework-v1", items: [{ id: "badge", badge: "Canonical badge", leader: "All leaders", equipment: "Ropes", notes: "Canonical badge instructions", durationMinutes: 15 }] }), entries, injuries: [], notes: "", testData: true });
  await db.doc(`parentWeeklyMeetings/${id}`).set({ section: "Scouts", meetingDate: "2099-07-22", status: "open", location: "Synthetic den", theme: "Canonical theme", activities: [{ name: "Canonical game", durationMinutes: 20, equipment: "Cones" }], badgework: [{ name: "Canonical badge", durationMinutes: 15, equipment: "Ropes" }] });
});
test.afterEach(async () => {
  const db = scheduleFixtureDb(); for (const recordId of [id, ...copies.splice(0)]) { for (const child of (await db.collection(`weeklyMeetings/${recordId}/leaderAttendance`).get()).docs) await child.ref.delete(); await db.doc(`weeklyMeetings/${recordId}`).delete(); await db.doc(`parentWeeklyMeetings/${recordId}`).delete(); }
  for (const path of ["siteSettings/meetingExperience", "siteSettings/scheduleExperience"]) await db.doc(path).delete();
});
for (const redesigned of [false, true]) test(`Canonical saves supersede stale legacy programme fields, including cleared values — redesign ${redesigned}`, async ({ page }) => {
  await scheduleFixtureDb().doc("siteSettings/meetingExperience").set({ version: redesigned ? "redesigned" : "existing" }); await enter(page);
  if (!redesigned) await page.getByRole("button", { name: "Programme", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Theme", exact: true })).toHaveValue("Canonical theme");
  if (redesigned) { await page.getByRole("button", { name: /^Activity 1: Canonical game/ }).click(); await page.getByRole("button", { name: /^Badgework 1: Legacy retained badge/ }).click(); await page.getByRole("button", { name: /^Badgework 2: Canonical badge/ }).click(); }
  await expect(page.getByRole("textbox", { name: "Activity 1", exact: true })).toHaveValue("Canonical game");
  await page.getByRole("textbox", { name: "Theme", exact: true }).fill(""); await page.getByRole("textbox", { name: "Activity 1", exact: true }).fill("Updated canonical game"); await page.getByRole("textbox", { name: "Programme notes", exact: true }).fill("");
  await expect(page.getByTestId("badgework-plan-row")).toHaveCount(2);
  await page.getByTestId("badgework-plan-row").first().getByRole("button", { name: "Remove", exact: true }).click(); await page.getByTestId("badgework-plan-row").first().getByRole("button", { name: "Remove", exact: true }).click(); await page.getByRole("button", { name: "Save Meeting", exact: true }).click();
  if (redesigned) await expect(page.getByTestId("meeting-save-state")).toHaveText("Saved"); else await expect(page.getByText("Meeting saved.", { exact: true })).toBeVisible();
  const data = (await scheduleFixtureDb().doc(`weeklyMeetings/${id}`).get()).data()!; expect(JSON.parse(data.programmeNotes)).toMatchObject({ theme: "", notes: "" }); expect(JSON.parse(data.plannedBadgework).items).toEqual([]); expect(data.theme).toBe("Stale legacy theme");
  await page.reload(); if (!redesigned) await page.getByRole("button", { name: "Programme", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Theme", exact: true })).toHaveValue(""); if (redesigned) await page.getByRole("button", { name: /^Activity 1: Updated canonical game/ }).click();
  await expect(page.getByRole("textbox", { name: "Activity 1", exact: true })).toHaveValue("Updated canonical game"); await expect(page.getByTestId("badgework-plan-row")).toHaveCount(0); await expect(page.getByText("Legacy retained badge", { exact: true })).toHaveCount(0);
});
test("Review closure requires Keep open or Save & close, Back dismisses, and failed save retains edits for retry", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 }); await enter(page); await page.getByRole("button", { name: "Review & close", exact: true }).click(); await expect(page.getByRole("button", { name: "Review", exact: true })).toHaveAttribute("aria-pressed", "true");
  const notes = page.getByRole("textbox", { name: "Additional meeting notes", exact: true }); await notes.fill("Retained closure notes");
  await page.getByRole("button", { name: "Save & close", exact: true }).click(); await expect(closeDialog(page)).toContainText("22-07-2099"); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: test.info().outputPath("close-confirmation-320.png") }); await expect(closeDialog(page).getByRole("button", { name: "Keep open", exact: true })).toBeFocused(); await closeDialog(page).getByRole("button", { name: "Keep open", exact: true }).click(); await waitForTransientOverlayHistory(page); await expect(notes).toHaveValue("Retained closure notes");
  await page.getByRole("button", { name: "Save & close", exact: true }).click(); await expect(closeDialog(page)).toBeVisible(); await page.goBack(); await expect(closeDialog(page)).toBeHidden(); await waitForTransientOverlayHistory(page);
  const ref = scheduleFixtureDb().doc(`weeklyMeetings/${id}`); const original = (await ref.get()).data()!; expect(original.status).toBe("open"); await ref.delete();
  await page.getByRole("button", { name: "Save & close", exact: true }).click(); await closeDialog(page).getByRole("button", { name: "Save & close", exact: true }).click(); await expect(closeDialog(page).getByRole("alert")).toContainText("Your edits are retained"); await expect(page).toHaveURL(new RegExp(`meeting=${id}`));
  await ref.set(original); await closeDialog(page).getByRole("button", { name: "Save & close", exact: true }).dblclick(); await expect(page).toHaveURL(/\/leader\/weekly$/); expect((await ref.get()).get("status")).toBe("closed"); expect((await ref.get()).get("notes")).toBe("Retained closure notes"); await expect(page.getByTestId(`meeting-history-${id}`)).toBeVisible();
});
test("More actions copies to a new section/date with a distinct ID and leaves the source unchanged", async ({ page }) => {
  const db = scheduleFixtureDb(); const source = (await db.doc(`weeklyMeetings/${id}`).get()).data(); await enter(page); await page.getByRole("button", { name: "More actions", exact: true }).click(); await page.getByRole("menuitem", { name: "Copy Meeting", exact: true }).click(); await expect(page).toHaveURL(`/leader/weekly/copy/${id}`);
  await page.getByRole("combobox", { name: "Destination section", exact: true }).click(); await page.getByRole("option", { name: "Cubs", exact: true }).click(); await expect(page.getByTestId("copy-attendance-preview")).toContainText("Cubs"); await waitForTransientOverlayHistory(page);
  await page.getByRole("textbox", { name: /^Choose date/ }).fill("2099-07-23"); await page.getByRole("button", { name: "Create Copy", exact: true }).click(); await page.getByRole("link", { name: "Open copied meeting", exact: true }).click(); const copyId = new URL(page.url()).searchParams.get("meeting")!; expect(copyId).not.toBe(id); copies.push(copyId);
  const copy = (await db.doc(`weeklyMeetings/${copyId}`).get()).data()!; expect(copy).toMatchObject({ section: "Cubs", meetingDate: "2099-07-23", status: "open", injuries: [], notes: "" }); expect(copy.entries.every((entry: Record<string, unknown>) => entry.attendance === "unrecorded" && !entry.uniform)).toBe(true); expect(JSON.parse(copy.plannedActivities).items[0].activity).toBe("Canonical game"); expect((await db.doc(`weeklyMeetings/${id}`).get()).data()).toEqual(source);
});
for (const schedule of [false, true]) test(`History deliberately reopens the exact record and returns to the list — schedule ${schedule}`, async ({ page }) => {
  const db = scheduleFixtureDb(); const ref = db.doc(`weeklyMeetings/${id}`); await ref.update({ status: "closed", notes: "Retained history notes" }); await db.doc(`parentWeeklyMeetings/${id}`).update({ status: "closed" }); await db.doc("siteSettings/scheduleExperience").set({ version: schedule ? "redesigned" : "existing" }); await login(page); await page.goto("/leader/weekly"); const row = page.getByTestId(`meeting-history-${id}`); await row.getByRole("button", { name: "Reopen Meeting", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "Reopen meeting?", exact: true }); await dialog.getByRole("button", { name: "Cancel", exact: true }).click(); await waitForTransientOverlayHistory(page); expect((await ref.get()).get("status")).toBe("closed");
  await row.getByRole("button", { name: "Reopen Meeting", exact: true }).click(); await dialog.getByRole("button", { name: "Reopen Meeting", exact: true }).click(); await expect(page).toHaveURL(new RegExp(`meeting=${id}$`)); await expect(page.getByRole("textbox", { name: "Theme", exact: true })).toHaveValue("Canonical theme"); expect((await ref.get()).get("status")).toBe("open"); expect((await ref.get()).get("notes")).toBe("Retained history notes");
  await page.getByRole("button", { name: "Back to Weekly Meetings", exact: true }).click(); await expect(page).toHaveURL(/\/leader\/weekly$/); await expect(page.getByTestId(`meeting-history-${id}`)).toHaveCount(0);
});
test("OFF retains the existing immediate Close Meeting experience", async ({ page }) => {
  await scheduleFixtureDb().doc("siteSettings/meetingExperience").set({ version: "existing" }); await enter(page); await page.getByRole("button", { name: "Close Meeting", exact: true }).click(); await expect(page).toHaveURL(/\/leader\/weekly$/); await expect(closeDialog(page)).toHaveCount(0); expect((await scheduleFixtureDb().doc(`weeklyMeetings/${id}`).get()).get("status")).toBe("closed");
});
