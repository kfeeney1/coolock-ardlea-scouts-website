import { expect, type Locator, type Page } from "@playwright/test";

export async function assertEndDatePickerMinimum(calendar: Locator, page: Page, minimumDate: string) {
  const description = page.locator(`[id="${await calendar.getAttribute("aria-describedby")}"]`);
  await expect(description).toHaveText(`Choose a date on or after ${minimumDate}. The selected date is not applied until you confirm.`);
  await expect(description).toHaveCSS("clip-path", "inset(50%)");
  await expect(description).toHaveCSS("position", "absolute");
  await expect(calendar.getByText(`Selected date: ${minimumDate}`, { exact: true })).toBeVisible();
  await expect(calendar.getByRole("button", { name: "Previous month" })).toBeVisible();
  await expect(calendar.getByRole("button", { name: "Next month" })).toBeVisible();
  await expect(calendar.getByRole("button", { name: "Confirm date" })).toBeVisible();
  await expect(calendar.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();

  const earlierDate = minimumDate.replace(/^(\d{2})-(\d{2})-(\d{4})$/, (_match, day, month, year) => {
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day) - 1));
    return [date.getUTCDate(), date.getUTCMonth() + 1, date.getUTCFullYear()].map((value, index) => String(value).padStart(index === 2 ? 4 : 2, "0")).join("-");
  });
  const earlierDateButton = calendar.getByRole("button", { name: `Select ${earlierDate}` });
  await expect(earlierDateButton).toBeDisabled();
  await earlierDateButton.click({ force: true });
  await expect(earlierDateButton).toBeDisabled();
  await expect(calendar.getByRole("button", { name: `Select ${minimumDate}` })).toHaveAttribute("aria-pressed", "true");

  const dialogBox = await calendar.boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(await page.evaluate(() => window.innerHeight));
  const content = await calendar.locator(".MuiDialogContent-root").evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
  expect(content.scrollHeight).toBeLessThanOrEqual(content.clientHeight + 1);
}

export async function assertStartDatePicker(calendar: Locator, page: Page) {
  const description = page.locator(`[id="${await calendar.getAttribute("aria-describedby")}"]`);
  await expect(description).toHaveText("Enter or select a date. The selected date is not applied until you confirm.");
  await expect(description).toHaveCSS("clip-path", "inset(50%)");
  await expect(description).toHaveCSS("position", "absolute");
  await expect(calendar.getByRole("button", { name: "Confirm date" })).toBeVisible();
  await expect(calendar.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  const content = await calendar.locator(".MuiDialogContent-root").evaluate((element) => ({ clientHeight: element.clientHeight, scrollHeight: element.scrollHeight }));
  expect(content.scrollHeight).toBeLessThanOrEqual(content.clientHeight + 1);
}
