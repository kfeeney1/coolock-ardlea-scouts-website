import { expect, test } from "@playwright/test";
import { login } from "./helpers/auth";

const password=process.env.E2E_TEST_PASSWORD;
const adminEmail=process.env.E2E_ADMIN_EMAIL;

test("SW-328 new meeting date follows section day until manually overridden", async ({ page }, testInfo) => {
  desktopOnly(testInfo); test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");
  await login(page, adminEmail!); await page.goto("/leader/weekly/create");
  const section = page.getByRole("combobox", { name: "Section" });
  const date = page.getByLabel("Meeting date");
  const expectWeekday = async (name: string, weekday: number) => {
    await section.click(); await page.getByRole("option", { name, exact: true }).click();
    const value = await date.inputValue();
    const parsed = new Date(`${value}T12:00:00`);
    expect(parsed.getDay()).toBe(weekday);
  };
  await expectWeekday("Cubs", 2); await expectWeekday("Ventures", 2); await expectWeekday("Beavers", 3); await expectWeekday("Scouts", 3);
  await date.fill("2099-04-17");
  await section.click(); await page.getByRole("option", { name: "Cubs", exact: true }).click();
  await expect(date).toHaveValue("2099-04-17");
});
