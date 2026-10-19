import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { clearScheduleMeetings, scheduleFixtureDb, seedScheduleMeetings } from "./support/schedule-fixtures";

const password = process.env.E2E_TEST_USER_PASSWORD;
test("Weekly schedule selects today, synchronises controls and preserves canonical destinations", async ({ page }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const today = await seedScheduleMeetings();
  try {
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto("/leader/settings");
    await page.getByRole("button", { name: "Redesigned schedules", exact: true }).click();
    await expect(page.getByRole("button", { name: "Redesigned schedules", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/leader/weekly");
    const schedule = page.getByRole("region", { name: "Meetings schedule", exact: true });
    const selected = schedule.getByRole("article", { name: "Scouts · Schedule fixture 1", exact: true });
    await expect(selected).toHaveAttribute("aria-current", "true");
    await expect(schedule.getByLabel("Meetings date", { exact: true })).toHaveValue(today);
    await expect(selected.getByText("Games & activities · 2", { exact: true })).toBeVisible();
    await expect(selected.getByText("River banks", { exact: true })).toBeVisible();
    await expect(selected.getByText("Teamwork · Level 2", { exact: true })).toBeVisible();
    await expect(selected.getByRole("link", { name: "Edit meeting", exact: true })).toHaveAttribute("href", "/leader/weekly?meeting=000-sw177-schedule-today");
    const browse = schedule.getByLabel("Browse Meetings; use Left and Right arrow keys", { exact: true });
    // Other regression fixtures can share a date. Keyboard navigation must move
    // exactly one rendered tile, rather than assume our past fixture is adjacent.
    const articles = schedule.locator("article");
    const currentIndex = await articles.evaluateAll(nodes => nodes.findIndex(node => node.getAttribute("aria-current") === "true"));
    expect(currentIndex).toBeGreaterThan(0);
    const previous = articles.nth(currentIndex - 1);
    const previousDestination = await previous.locator('a[href^="/leader/weekly?meeting="]').getAttribute("href");
    expect(previousDestination).toMatch(/^\/leader\/weekly\?meeting=.+$/);
    await browse.focus(); await page.keyboard.press("ArrowLeft");
    await expect(previous).toHaveAttribute("aria-current", "true");
    await expect(schedule.getByRole("article").locator('a[href^="/leader/weekly?meeting="]')).toHaveAttribute("href", previousDestination!);
    await expect(browse).toBeFocused();
    await schedule.getByLabel("Meetings date", { exact: true }).fill(today);
    await expect(selected).toHaveAttribute("aria-current", "true");
    const pastFixture = await scheduleFixtureDb().collection("weeklyMeetings").doc("000-sw177-schedule-past").get();
    await schedule.getByLabel("Meetings date", { exact: true }).fill(pastFixture.get("meetingDate"));
    const past = schedule.getByRole("article", { name: "Scouts · Schedule fixture 0", exact: true });
    await expect(past).toHaveAttribute("aria-current", "true");
    await expect(past.getByRole("link", { name: "Edit meeting", exact: true })).toHaveCount(0);
    await expect(past.getByRole("link", { name: "View meeting", exact: true })).toHaveAttribute("href", "/leader/weekly?meeting=000-sw177-schedule-past");
    await expect(past.getByRole("link", { name: "Copy meeting", exact: true })).toHaveAttribute("href", "/leader/weekly/copy/000-sw177-schedule-past");
    await schedule.getByLabel("Meetings date", { exact: true }).fill(today);
    await expect(selected).toHaveAttribute("aria-current", "true");
    await selected.getByRole("link", { name: "Edit meeting", exact: true }).click();
    await expect(page).toHaveURL(/\/leader\/weekly\?meeting=000-sw177-schedule-today$/);
    await expect(page.getByRole("button", { name: "Programme", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Save Meeting", exact: true }).click();
    await expect(page.getByText("Meeting saved.", { exact: true })).toBeVisible();
    await page.goto("/leader/settings");
    await page.getByRole("button", { name: "Existing schedules", exact: true }).click();
    await expect(page.getByRole("button", { name: "Existing schedules", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/leader/weekly");
    await expect(page.getByRole("region", { name: "Meetings schedule", exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: new RegExp(`${today.split("-").reverse().join("-")} · Scouts`) })).toBeVisible();
  } finally { await clearScheduleMeetings(); }
});
