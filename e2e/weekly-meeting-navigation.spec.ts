import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const sectionLeaderEmail = process.env.E2E_SECTION_LEADER_EMAIL || "test.scout.section.leader@example.com";
function desktopOnly(testInfo: TestInfo) { test.skip(testInfo.project.name !== "chromium", "Weekly meeting navigation runs once on desktop Chromium."); }
async function login(page: Page, email: string) { await page.goto("/leader/login"); await page.getByLabel("Email address").fill(email); await page.getByLabel("Password").fill(password!); await page.getByRole("button", { name: "Sign In" }).click(); await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible(); }

async function ensureOpenScoutsMeeting(page: Page) {
  await page.goto("/leader/weekly");
  const openMeeting = page.getByRole("button", { name: /· Scouts/ }).first();
  if (await openMeeting.count()) return;

  await page.getByRole("link", { name: "Create Meeting" }).click();
  await expect(page.getByRole("heading", { name: "Create Meeting" })).toBeVisible();
  await page.getByLabel("Meeting date").fill("2099-12-29");
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=/);

  await page.goto("/leader/weekly");
  await expect(page.getByRole("button", { name: /· Scouts/ }).first()).toBeVisible();
}

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

test("SW-369 open weekly meeting returns to the Weekly Meetings list with its menu context", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Weekly meeting return navigation runs on desktop and Pixel 7 Chromium.");
  test.skip(!password || !sectionLeaderEmail, "Configure canonical E2E section leader credentials.");

  await login(page, sectionLeaderEmail);
  await ensureOpenScoutsMeeting(page);
  await expect(page.getByRole("heading", { name: "Weekly Meetings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu · Weekly Meetings" })).toBeVisible();

  const meeting = page.getByRole("button", { name: /· Scouts/ }).first();
  await expect(meeting).toBeVisible();
  await meeting.click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=/);

  await page.getByRole("button", { name: "Back to Weekly Meetings", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly$/);
  await expect(page.getByText("Open Meeting", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu · Weekly Meetings" })).toBeVisible();

  await page.getByRole("button", { name: "Menu · Weekly Meetings" }).click();
  const weeklyNav = page.getByTestId("leader-nav-weekly-meetings");
  await expect(weeklyNav).toHaveCount(2);
  await expect(weeklyNav.nth(0)).toHaveAttribute("aria-current", "page");
  await expect(weeklyNav.nth(1)).toHaveAttribute("aria-current", "page");
});

test("SW-369 browser Back from an open weekly meeting returns to the meeting list", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Weekly meeting return navigation runs on desktop and Pixel 7 Chromium.");
  test.skip(!password || !sectionLeaderEmail, "Configure canonical E2E section leader credentials.");

  await login(page, sectionLeaderEmail);
  await ensureOpenScoutsMeeting(page);
  await expect(page.getByRole("heading", { name: "Weekly Meetings" })).toBeVisible();
  const meeting = page.getByRole("button", { name: /· Scouts/ }).first();
  await expect(meeting).toBeVisible();
  await meeting.click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=/);

  await page.goBack();
  await expect(page).toHaveURL(/\/leader\/weekly$/);
  await expect(page.getByText("Open Meeting", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu · Weekly Meetings" })).toBeVisible();

  await page.getByRole("button", { name: "Menu · Weekly Meetings" }).click();
  const weeklyNav = page.getByTestId("leader-nav-weekly-meetings");
  await expect(weeklyNav).toHaveCount(2);
  await expect(weeklyNav.nth(0)).toHaveAttribute("aria-current", "page");
  await expect(weeklyNav.nth(1)).toHaveAttribute("aria-current", "page");
});
