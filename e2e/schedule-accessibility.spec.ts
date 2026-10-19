import { expect, test } from "@playwright/test";
import axe from "axe-core";
import { loginAsLeader } from "./support/authentication-helpers";
import { clearScheduleEvents, clearScheduleMeetings, seedScheduleEvents, seedScheduleMeetings } from "./support/schedule-fixtures";
const password = process.env.E2E_TEST_USER_PASSWORD;
test("Schedule tiles wrap on mobile, expose selection, retain keyboard focus and capture both pages", async ({ page }, testInfo) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const today = await seedScheduleMeetings(); await seedScheduleEvents();
  try {
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto("/leader/settings");
    const choice = page.getByRole("button", { name: "Redesigned schedules", exact: true });
    await choice.click(); await expect(choice).toHaveAttribute("aria-pressed", "true");
    for (const [path, label] of [["weekly", "Meetings"], ["events", "Events"]]) {
      await page.goto(`/leader/${path}`);
      const schedule = page.getByRole("region", { name: `${label} schedule`, exact: true });
      await expect(schedule.getByRole("article")).toHaveCount(1);
      await expect(schedule.getByRole("article")).toHaveAttribute("aria-current", "true");
      const browse = schedule.getByLabel(`Browse ${label}; use Left and Right arrow keys`, { exact: true });
      await browse.focus(); await page.keyboard.press("ArrowRight");
      await expect(browse).toBeFocused();
      await expect(schedule.getByRole("article")).toHaveCount(1);
      await expect(schedule.getByRole("status")).toContainText(/\d{2}-\d{2}-\d{4}/);
      const bounds = await page.evaluate(() => ({ width: window.innerWidth, page: document.documentElement.scrollWidth }));
      expect(bounds.page).toBeLessThanOrEqual(bounds.width);
      const undersized = await schedule.getByRole("button").evaluateAll(elements => elements.filter(element => { const rect = element.getBoundingClientRect(); return rect.width < 44 || rect.height < 44; }).map(element => element.textContent));
      expect(undersized).toEqual([]);
      await page.addScriptTag({ content: axe.source });
      const violations = await page.evaluate(async () => {
        const engine = (window as unknown as { axe: typeof axe }).axe;
        const result = await engine.run('[aria-label$=" schedule"]', { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } });
        return result.violations.map(violation => ({ id: violation.id, impact: violation.impact }));
      });
      expect(violations).toEqual([]);
      const dates = schedule.getByRole("group", { name: `${label} dates`, exact: true });
      const fixtureTitle = path === "weekly" ? "Scouts · Schedule fixture 1" : "Schedule event 1";
      const dateButton = dates.getByRole("button", { name: `Select ${today.split("-").reverse().join("-")} · ${fixtureTitle}`, exact: true });
      await dateButton.click();
      await expect(dateButton).toHaveAttribute("aria-pressed", "true");
      await expect(dateButton.getByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/, { exact: true })).toBeVisible();
      const fixture = schedule.getByRole("article", { name: fixtureTitle, exact: true });
      await expect(fixture).toHaveAttribute("aria-current", "true");
      const record = path === "weekly" ? "/leader/weekly?meeting=000-sw177-schedule-today" : "/leader/events/000-sw177-event-today/edit";
      await expect(fixture.getByRole("link", { name: path === "weekly" ? "Edit meeting" : "Edit event", exact: true })).toHaveAttribute("href", record);
      // The chosen card is centred, with actual neighbours peeking into view.
      await expect.poll(() => browse.evaluate(node => {
        const viewport = node.getBoundingClientRect();
        return Array.from(node.children).filter(child => { const card = child.getBoundingClientRect(); return card.right > viewport.left + 1 && card.left < viewport.right - 1; }).length;
      })).toBe(3);
      await expect.poll(async () => {
        const card = await fixture.boundingBox(); const viewport = await browse.boundingBox();
        return Math.abs(card!.x + card!.width / 2 - viewport!.x - viewport!.width / 2);
      }).toBeLessThan(2);
      await dateButton.press("ArrowRight");
      await expect(dates.getByRole("button", { pressed: true })).toBeFocused();
      await expect(dateButton).toHaveAttribute("aria-pressed", "false");
      await dateButton.click();
      await expect(fixture).toHaveAttribute("aria-current", "true");
      const screenshot = testInfo.outputPath(`${path}-${testInfo.project.name}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      await testInfo.attach(`${label} ${testInfo.project.name}`, { path: screenshot, contentType: "image/png" });
    }
  } finally { await clearScheduleMeetings(); await clearScheduleEvents(); }
});
