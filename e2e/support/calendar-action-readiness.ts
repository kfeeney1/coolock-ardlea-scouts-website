import { expect, type Page } from "@playwright/test";

/** Catch links becoming interactive while source completion can move the footer. */
export async function monitorCalendarActionReadiness(page: Page) {
  await page.addInitScript(() => {
    const state = { earlyAction: false };
    Object.assign(window, { calendarActionReadiness: state });
    new MutationObserver(() => {
      const calendar = document.querySelector('[data-testid="page-group-calendar"]');
      const loading = [...(calendar?.querySelectorAll('[role="status"]') || [])]
        .some(status => status.textContent?.includes("Loading Calendar records"));
      if (loading && [...(calendar?.querySelectorAll('[data-calendar-schedule-action]') || [])]
        .some(action => action.getAttribute("aria-disabled") !== "true")) state.earlyAction = true;
    }).observe(document, {childList: true, subtree: true, attributes: true, attributeFilter: ["aria-disabled"]});
  });
}

export async function expectCalendarActionsReady(page: Page) {
  const actions = page.locator('[data-calendar-schedule-action]');
  await expect(actions).toHaveCount(2);
  await expect(actions.nth(0)).toBeEnabled();
  await expect(actions.nth(1)).toBeEnabled();
  expect(await page.evaluate(() => (window as typeof window & {
    calendarActionReadiness: {earlyAction: boolean};
  }).calendarActionReadiness.earlyAction)).toBe(false);
}
