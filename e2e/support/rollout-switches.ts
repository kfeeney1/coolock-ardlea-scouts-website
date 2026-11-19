import { expect, type Page } from "@playwright/test";

export function rolloutSwitch(page: Page, kind: "navigation" | "schedules") {
  return page.getByRole("switch", { name: `Redesigned ${kind}`, exact: true });
}

export async function setRolloutSwitch(page: Page, kind: "navigation" | "schedules", enabled: boolean) {
  const control = rolloutSwitch(page, kind);
  await expect(control).toBeEnabled();
  if (await control.isChecked() !== enabled) await control.click();
  await expect(control).toBeChecked({ checked: enabled });
}
