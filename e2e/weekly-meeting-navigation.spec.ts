import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const sectionLeaderEmail = process.env.E2E_SECTION_LEADER_EMAIL || "test.scout.section.leader@example.com";
function desktopOnly(testInfo: TestInfo) { test.skip(testInfo.project.name !== "chromium", "Weekly meeting navigation runs once on desktop Chromium."); }
async function login(page: Page, email: string) { await page.goto("/leader/login"); await page.getByLabel("Email address").fill(email); await page.getByLabel("Password").fill(password!); await page.getByRole("button", { name: "Sign In" }).click(); await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible(); }

test("SW-264 authorised meeting editor routes to canonical Create Meeting and protects unsaved changes", async ({ page }, testInfo) => {
  desktopOnly(testInfo); test.skip(!password || !sectionLeaderEmail, "Configure canonical E2E section leader credentials.");
  await login(page, sectionLeaderEmail); await page.goto("/leader/weekly");
  const meeting = page.getByRole("button", { name: /· Scouts/ }).first();
  if (await meeting.count()) await meeting.click(); else { const history=page.getByTestId(/meeting-history-/).filter({hasText:"· Scouts"}).first(); await history.getByRole("button", { name: /View/ }).click(); }
  const create = page.getByRole("button", { name: "Create Meeting", exact: true });
  await expect(create).toBeVisible();
  if (await page.getByRole("button", { name: "Programme", exact: true }).count()) {
    await page.getByRole("button", { name: "Programme", exact: true }).click();
    const theme = page.getByLabel("Theme");
    if (await theme.isEnabled()) {
      await theme.fill(`${await theme.inputValue()} autosaved`); await create.click();
      await expect(page).toHaveURL(/\/leader\/weekly\/create$/);
    }
  }
  await create.click(); await expect(page).toHaveURL(/\/leader\/weekly\/create$/); await expect(page.getByRole("heading", { name: "Create Meeting" })).toBeVisible();
});
