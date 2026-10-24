import { expect, type Page } from "@playwright/test";

/** Read-only rollout contract: an empty result must still be the matrix surface. */
export async function expectAttendancePresentation(page: Page, enabled: boolean) {
  const surface = page.getByRole("region", { name: "Attendance matrix", exact: true });
  const table = page.getByRole("table", { name: "Member attendance by meeting", exact: true });
  const empty = surface.getByRole("alert").filter({ hasText: /^No members or closed meetings match the current filters\.$/ });
  await expect(page.getByRole("alert").filter({ hasText: /Unable to load attendance|permission denied/i })).toHaveCount(0);
  if (!enabled) {
    await expect(surface).toHaveCount(0);
    await expect(table).toHaveCount(0);
    return;
  }
  await expect(surface).toBeVisible();
  await expect(surface.getByRole("heading", { name: "Attendance matrix", exact: true })).toBeVisible();
  await expect(surface.getByLabel("Attendance legend", { exact: true })).toBeVisible();
  // Locator.or remains strict: both results appearing at once is also a failure.
  await expect(surface.getByRole("table", { name: "Member attendance by meeting", exact: true }).or(empty)).toBeVisible();
  if (await table.isVisible()) {
    await expect(empty).toHaveCount(0);
    await expect(table.getByRole("columnheader").first()).toHaveText("Member");
    expect(await table.getByRole("columnheader").count()).toBeGreaterThan(1);
    await expect(table.getByRole("rowheader").first()).toBeVisible();
  } else {
    await expect(table).toHaveCount(0);
    await expect(empty).toBeVisible();
  }
}
