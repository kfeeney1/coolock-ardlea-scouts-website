import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password=process.env.E2E_TEST_USER_PASSWORD;
const adminEmail=process.env.E2E_ADMIN_EMAIL;\nfunction desktopOnly(testInfo: TestInfo) { test.skip(testInfo.project.name !== "chromium", "Meeting date defaults run once on desktop Chromium."); }\nasync function login(page: Page, email: string) { await page.goto("/leader/login"); await page.getByLabel("Email address").fill(email); await page.getByLabel("Password").fill(password!); await page.getByRole("button", { name: "Sign In" }).click(); await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible(); }

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
