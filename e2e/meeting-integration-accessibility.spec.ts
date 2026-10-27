import { expect, test, type Page } from "@playwright/test";
import axe from "axe-core";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { waitForTransientOverlayHistory } from "./helpers/transientOverlayHistory";
import { reconcileOpenWeeklyRoster } from "../src/services/weeklyTrackerLogic";
const password = process.env.E2E_TEST_USER_PASSWORD;
const id = "000-sw425-integration";
const uid = "TEST_uid_super_admin_01";
const created: string[] = [];
let originalTheme: unknown;
test.beforeEach(async () => {
  test.skip(!password, "Configure canonical E2E credentials."); const db = scheduleFixtureDb(); originalTheme = (await db.doc(`adminUsers/${uid}`).get()).get("uiTheme") ?? "default";
  await db.doc("siteSettings/meetingExperience").set({ version: "redesigned" });
  const members = (await db.collection("members").get()).docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const entries = reconcileOpenWeeklyRoster([], members as Parameters<typeof reconcileOpenWeeklyRoster>[1], "Scouts");
  await db.doc(`weeklyMeetings/${id}`).set({ section: "Scouts", meetingDate: "2099-07-22", status: "open", location: "Synthetic den", programmeNotes: JSON.stringify({ marker: "weekly-programme-v1", theme: "Long synthetic programme title that wraps at narrow widths", notes: "Programme notes retained" }), plannedActivities: JSON.stringify({ marker: "weekly-activities-v1", items: [{ id: "one", activity: "Long synthetic game name that must wrap without clipping", leader: "Guest leader", equipment: "Cones and ropes", notes: "Instructions retained through all three meeting stages.", durationMinutes: 20 }] }), plannedBadgework: JSON.stringify({ marker: "weekly-badgework-v1", authoritative: true, items: [] }), entries, injuries: [], notes: "", testData: true });
});
test.afterEach(async () => {
  const db = scheduleFixtureDb(); await db.doc(`adminUsers/${uid}`).update({ uiTheme: originalTheme });
  for (const recordId of [id, ...created.splice(0)]) { for (const child of (await db.collection(`weeklyMeetings/${recordId}/leaderAttendance`).get()).docs) await child.ref.delete(); await db.doc(`weeklyMeetings/${recordId}`).delete(); await db.doc(`parentWeeklyMeetings/${recordId}`).delete(); }
  for (const path of ["siteSettings/meetingExperience", "siteSettings/scheduleExperience"]) await db.doc(path).delete();
});
async function verifyAccessibility(page: Page, selector: string) {
  const root = page.locator(selector);
  // Contrast is measured after the surface has finished its actual fade transition.
  await expect.poll(() => root.evaluate(element => { let node: Element | null = element; while (node) { if (Number(getComputedStyle(node).opacity) !== 1) return false; node = node.parentElement; } return true; })).toBe(true);
    const undersized = await root.locator('button:not(:disabled), [role="combobox"]:not([aria-disabled="true"]), input[type="checkbox"]:not(:disabled)').evaluateAll(elements => elements.flatMap(element => {
      const target = element.matches('input[type="checkbox"]') ? element.closest('.MuiCheckbox-root')! : element;
      const rect = target.getBoundingClientRect(); if (!rect.width || !rect.height) return [];
      return rect.width < 44 || rect.height < 44 ? [{ label: element.getAttribute("aria-label") || element.textContent, width: rect.width, height: rect.height }] : [];
    })); expect(undersized).toEqual([]);
    const violations = await page.evaluate(async (selector) => (await (window as unknown as { axe: typeof axe }).axe.run(selector, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })), selector);
    expect(violations).toEqual([]); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
for (const theme of ["default", "modern", "irish-adventure", "uk-campaign", "programme-led"]) test(`All meeting stages retain labels, contrast, keyboard and 44px targets — ${theme}`, async ({ page }, info) => {
  if (info.project.name === "mobile-chromium") await page.setViewportSize({ width: 320, height: 800 });
  await scheduleFixtureDb().doc(`adminUsers/${uid}`).update({ uiTheme: theme });
  await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! }); await page.goto("/leader/weekly/create"); await expect(page.getByRole("button", { name: "Create & plan", exact: true })).toBeVisible(); await expect(page.locator("html")).toHaveAttribute("data-ui-theme", theme); await page.addScriptTag({ content: axe.source }); await verifyAccessibility(page, '[data-testid="meeting-create-page"]'); await page.goto(`/leader/weekly?meeting=${id}`);
  await expect(page.getByTestId("leader-dashboard-header")).toBeVisible(); await expect(page.getByRole("banner").getByRole("img").first()).toBeVisible();
  await page.addScriptTag({ content: axe.source });
  for (const stage of ["Plan", "Run", "Review"]) {
    const button = page.getByRole("button", { name: stage, exact: true }); await button.focus(); await page.keyboard.press("Enter"); await expect(button).toBeFocused(); await expect(button).toHaveAttribute("aria-pressed", "true");
    await verifyAccessibility(page, '[data-testid="page-weekly-meetings"]');
  }
  await page.getByRole("button", { name: "Save & close", exact: true }).click(); const dialog = page.getByRole("dialog", { name: "Save & close meeting?", exact: true }); await expect(dialog.getByRole("button", { name: "Keep open", exact: true })).toBeFocused(); await verifyAccessibility(page, '[role="dialog"]'); await dialog.getByRole("button", { name: "Keep open", exact: true }).click(); await waitForTransientOverlayHistory(page);
  await page.getByRole("button", { name: "Plan", exact: true }).click(); const disclosure = page.getByRole("button", { name: /^Activity 1: Long synthetic/ }); await disclosure.focus(); await page.keyboard.press("Enter"); await expect(disclosure).toBeFocused(); await expect(page.getByRole("textbox", { name: "Activity 1", exact: true })).toHaveValue("Long synthetic game name that must wrap without clipping");
});
for (const schedule of [false, true]) test(`Create through share, pending incident, canonical tracker return and confirmed closure — schedule ${schedule}`, async ({ page }) => {
  const db = scheduleFixtureDb(); await db.doc("siteSettings/scheduleExperience").set({ version: schedule ? "redesigned" : "existing" });
  await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! }); await page.goto("/leader/weekly/create");
  await page.getByRole("textbox", { name: /^Meeting date/ }).fill("2099-07-23"); await page.getByRole("textbox", { name: "Theme / programme title", exact: true }).fill("Synthetic integrated meeting"); await page.getByRole("button", { name: "Create & plan", exact: true }).click(); await expect(page).toHaveURL(/\/leader\/weekly\?meeting=.+/); const meetingId = new URL(page.url()).searchParams.get("meeting")!; created.push(meetingId);
  await page.getByRole("textbox", { name: "Activity 1", exact: true }).fill("Integrated game"); await page.getByRole("button", { name: "Share programme", exact: true }).click(); const share = page.getByRole("dialog", { name: "Share programme", exact: true }); await expect(share.getByRole("link", { name: "Share in WhatsApp", exact: true })).toBeVisible(); await share.getByRole("button", { name: "Close", exact: true }).click(); await waitForTransientOverlayHistory(page);
  await page.getByRole("button", { name: "Run", exact: true }).click(); await page.getByTestId("attendance-list").getByRole("checkbox", { name: /^Attendance/ }).first().check(); await page.getByRole("combobox", { name: "Incident member" }).click(); await page.getByRole("option").first().click(); await waitForTransientOverlayHistory(page); await page.getByRole("textbox", { name: "Injury / medical concern" }).fill("Synthetic pending incident");
  await page.getByRole("button", { name: "Review", exact: true }).click(); await page.getByTestId("weekly-adventure-badgework-link").click(); await expect(page).toHaveURL(/\/leader\/badgework\?/); const ref = db.doc(`weeklyMeetings/${meetingId}`); expect((await ref.get()).get("injuries")).toHaveLength(1);
  await page.getByRole("link", { name: "Back to Weekly Meeting", exact: true }).click(); await expect(page.getByRole("button", { name: "Review", exact: true })).toHaveAttribute("aria-pressed", "true"); await page.getByRole("textbox", { name: /^Other completed badges/ }).fill("Synthetic meeting-only badge"); await page.getByRole("textbox", { name: "Additional meeting notes", exact: true }).fill("Integrated notes");
  await page.getByRole("button", { name: "Save & close", exact: true }).click(); const close = page.getByRole("dialog", { name: "Save & close meeting?", exact: true }); await close.getByRole("button", { name: "Save & close", exact: true }).click(); await expect(page).toHaveURL(/\/leader\/weekly$/); const saved = (await ref.get()).data()!; expect(saved.status).toBe("closed"); expect(saved.injuries).toHaveLength(1); expect(saved.notes).toBe("Integrated notes"); await expect(page.getByTestId(`meeting-history-${meetingId}`)).toBeVisible();
});
test("Direct out-of-section routes are denied without disclosing meeting content", async ({ page }) => {
  const db = scheduleFixtureDb(); const blockedId = `${id}-blocked`; created.push(blockedId);
  const source = (await db.doc(`weeklyMeetings/${id}`).get()).data()!; await db.doc(`weeklyMeetings/${blockedId}`).set({ ...source, section: "Cubs", programmeNotes: JSON.stringify({ marker: "weekly-programme-v1", theme: "PRIVATE OUTSIDE SECTION", notes: "PRIVATE OUTSIDE SECTION" }) });
  await loginAsLeader(page, { email: "test.scout.programme.scouter@example.com", password: password! }); await page.goto(`/leader/weekly?meeting=${blockedId}`);
  await expect(page.getByRole("alert").filter({ hasText: "This meeting could not be found or is outside your permitted sections." })).toBeVisible(); await expect(page.getByTestId("meeting-workflow-shell")).toHaveCount(0); await expect(page.getByText("PRIVATE OUTSIDE SECTION", { exact: true })).toHaveCount(0);
});
