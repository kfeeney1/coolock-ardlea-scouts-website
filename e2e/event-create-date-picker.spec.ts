import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { assertEndDatePickerMinimum, assertStartDatePicker } from "./support/end-date-picker-assertions";

const password = process.env.E2E_TEST_USER_PASSWORD;

const adminEmail = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com";

test("future start opens the shared end calendar at a valid date and only applies after confirmation", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");

  const start = page.getByRole("textbox", { name: /^Start date/ });
  const end = page.getByRole("textbox", { name: "End date", exact: true });
  await expect(start).toHaveAttribute("type", "text");
  await expect(end).toHaveAttribute("type", "text");
  await expect(end).toBeDisabled();
  await expect(page.getByText("Enter a valid start date.", { exact: true })).toBeVisible();
  await start.fill("2099-04-02");
  await expect(end).toBeEnabled();
  await expect(end).toHaveAttribute("data-min-date", "2099-04-02");
  await expect(end).toHaveValue("");
  await page.getByRole("button", { name: "Choose end date" }).click();
  const calendar = page.getByRole("dialog", { name: "Choose end date" });
  await assertEndDatePickerMinimum(calendar, page, "02-04-2099");
  await calendar.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(end).toHaveValue("");
  await page.getByRole("button", { name: "Choose end date" }).click();
  const reopenedCalendar = page.getByRole("dialog", { name: "Choose end date" });
  await expect(reopenedCalendar.getByRole("button", { name: "Select 02-04-2099" })).toHaveAttribute("aria-pressed", "true");
  await reopenedCalendar.getByRole("button", { name: "Confirm date" }).click();
  await expect(end).toHaveValue("02-04-2099");

  await end.fill("04-04-2099");
  await expect(end).toHaveValue("04-04-2099");
  await end.blur();

  await start.fill("2099-04-05");
  await expect(end).toHaveValue("");
  await expect(page.getByRole("alert")).toContainText("end date was cleared");

  await end.fill("04-04-2099");
  await expect(end).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText("End date cannot be before the start date");
  await expect(end).toHaveValue("04-04-2099");

  await end.fill("31-02-2099");
  await expect(end).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByRole("alert")).toContainText("Enter a real date");
  await start.fill("2099-04-06");
  await expect(end).toHaveValue("31-02-2099");
  await expect(page.getByRole("alert")).toContainText("Enter a real date");
  await start.fill("");
  await expect(start).toHaveAttribute("aria-invalid", "true");
  await expect(end).toBeDisabled();
  await expect(end).toHaveValue("31-02-2099");

  await start.fill("2099-12-31");
  await page.getByRole("button", { name: "Choose end date" }).click();
  const yearBoundaryCalendar = page.getByRole("dialog", { name: "Choose end date" });
  await expect(yearBoundaryCalendar.getByRole("button", { name: "Select 31-12-2099" })).toHaveAttribute("aria-pressed", "true");
  await yearBoundaryCalendar.getByRole("button", { name: "Next month" }).click();
  await expect(yearBoundaryCalendar.getByRole("button", { name: "Select 01-01-2100" })).toBeVisible();
  await yearBoundaryCalendar.getByRole("button", { name: "Select 01-01-2100" }).click();
  await yearBoundaryCalendar.getByRole("button", { name: "Confirm date" }).click();
  await expect(end).toHaveValue("01-01-2100");
});

test("standalone date fields use the same confirmable calendar on mobile and desktop", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/events/create");

  const start = page.getByRole("textbox", { name: /^Start date/ });
  await expect(start).toHaveAttribute("type", "text");
  await start.fill("2096-02-28");
  await expect(start).toHaveValue("28-02-2096");
  const calendarTrigger = page.getByRole("button", { name: "Choose start date" });
  await calendarTrigger.click();
  const calendar = page.getByRole("dialog", { name: "Choose start date" });
  await expect(calendar.getByRole("button", { name: "Select 29-02-2096" })).toBeVisible();
  const calendarGrid = calendar.locator('[role="group"]');
  await expect(calendarGrid).toBeVisible();
  await expect(calendarGrid).toHaveAttribute("aria-label", "February 2096 dates");
  await expect(calendar.locator('[aria-label="Mon"]')).toHaveText("Mon");
  await expect(calendar.getByRole("button", { name: "Select 28-02-2096" })).toHaveAttribute("aria-pressed", "true");
  await assertStartDatePicker(calendar, page);
  const bounds = await calendar.boundingBox();
  const viewport = page.viewportSize();
  expect(bounds && viewport && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height).toBe(true);
  await calendar.getByRole("button", { name: "Next month" }).click();
  await expect(calendar.getByRole("button", { name: "Select 28-03-2096" })).toBeVisible();
  await calendar.getByRole("button", { name: "Select 15-03-2096" }).click();
  await expect(calendar.getByText("Selected date: 15-03-2096", { exact: true })).toBeVisible();
  await calendar.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(start).toHaveValue("28-02-2096");
  await expect(calendarTrigger).toBeFocused();

  await page.getByRole("button", { name: "Choose start date" }).click();
  const reopened = page.getByRole("dialog", { name: "Choose start date" });
  await expect(reopened.getByRole("button", { name: "Select 28-02-2096" })).toHaveAttribute("aria-pressed", "true");
  const selectedDay = reopened.getByRole("button", { name: "Select 29-02-2096" });
  await selectedDay.focus();
  await expect(selectedDay).toBeFocused();
  await selectedDay.press("ArrowRight");
  await expect(reopened.getByText("March 2096", { exact: true })).toBeVisible();
  await expect(reopened.getByRole("button", { name: "Select 01-03-2096" })).toBeFocused();
  await reopened.getByRole("button", { name: "Previous month" }).click();
  await reopened.getByRole("button", { name: "Select 29-02-2096" }).click();
  await reopened.getByRole("button", { name: "Confirm date" }).click();
  await expect(start).toHaveValue("29-02-2096");
  await expect(start).toHaveAttribute("aria-invalid", "false");

  await start.fill("31-02-2096");
  await expect(start).toHaveAttribute("aria-invalid", "true");
  expect(await start.evaluate((node: HTMLInputElement) => node.checkValidity())).toBe(false);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test.describe("date-only calendar in Europe/Dublin", () => {
  test.use({ timezoneId: "Europe/Dublin" });

  test("the daylight-saving boundary remains the same date through the picker", async ({ page }) => {
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    await loginAsLeader(page, { email: adminEmail, password: password! });
    await page.goto("/leader/events/create");
    const start = page.getByRole("textbox", { name: /^Start date/ });
    await start.fill("2026-10-25");
    await expect(start).toHaveValue("25-10-2026");
    await page.getByRole("button", { name: "Choose start date" }).click();
    const calendar = page.getByRole("dialog", { name: "Choose start date" });
    await expect(calendar.getByRole("button", { name: "Select 25-10-2026" })).toHaveAttribute("aria-pressed", "true");
    await calendar.getByRole("button", { name: "Confirm date" }).click();
    await expect(start).toHaveValue("25-10-2026");
  });
});
