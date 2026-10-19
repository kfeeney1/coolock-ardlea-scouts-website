import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { clearScheduleEvents, seedScheduleEvents } from "./support/schedule-fixtures";
const password = process.env.E2E_TEST_USER_PASSWORD;
test("Event schedule preserves summaries, date selection, past actions and legacy fallback", async ({ page }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const today = await seedScheduleEvents();
  try {
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto("/leader/settings");
    const redesigned = page.getByRole("button", { name: "Redesigned schedules", exact: true });
    await redesigned.click(); await expect(redesigned).toHaveAttribute("aria-pressed", "true");
    await page.goto("/leader/events");
    await page.getByLabel("Search events", { exact: true }).fill("Schedule event");
    const schedule = page.getByRole("region", { name: "Events schedule", exact: true });
    const selected = schedule.getByRole("article", { name: "Schedule event 1", exact: true });
    await expect(selected).toHaveAttribute("aria-current", "true");
    await expect(schedule.getByLabel("Events date", { exact: true })).toHaveValue(today);
    await expect(selected.getByText("1 attending · 0 not attending · 0 invited", { exact: true })).toBeVisible();
    await expect(selected.getByText("1 consent received · 0 consent outstanding", { exact: true })).toBeVisible();
    await expect(selected.getByRole("link", { name: "Edit event", exact: true })).toHaveAttribute("href", "/leader/events/000-sw177-event-today/edit");
    await schedule.getByRole("button", { name: "Previous", exact: true }).click();
    const past = schedule.getByRole("article", { name: "Schedule event 0", exact: true });
    await expect(past).toHaveAttribute("aria-current", "true");
    await expect(past.getByRole("link", { name: "Edit event", exact: true })).toHaveCount(0);
    await past.getByRole("link", { name: "View event", exact: true }).click();
    await expect(page).toHaveURL(/\/leader\/events\/000-sw177-event-past$/);
    await expect(page.getByRole("heading", { name: "Schedule event 0", exact: true })).toBeVisible();
    await page.goto("/leader/settings");
    const existing = page.getByRole("button", { name: "Existing schedules", exact: true });
    await existing.click(); await expect(existing).toHaveAttribute("aria-pressed", "true");
    await page.goto("/leader/events");
    await expect(page.getByRole("region", { name: "Events schedule", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Open Schedule event 1", exact: true })).toBeVisible();
  } finally { await clearScheduleEvents(); }
});
