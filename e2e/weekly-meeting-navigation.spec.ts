import { expect, test, type Locator, type TestInfo } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
const sectionLeaderEmail = process.env.E2E_SECTION_LEADER_EMAIL || "test.scout.section.leader@example.com";
function desktopOnly(testInfo: TestInfo) { test.skip(testInfo.project.name !== "chromium", "Weekly meeting navigation runs once on desktop Chromium."); }
async function expectFilledAction(control: Locator) {
  await expect(control).toBeVisible();
  const disabled = (await control.getAttribute("aria-disabled")) === "true" || !(await control.isEnabled());
  if (!disabled) await expect(control).toHaveCSS("color", "rgb(255, 255, 255)");
  const background = await control.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
  await expect(control).toHaveCSS("min-height", "44px");
}


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
  await loginAsLeader(page, { email: sectionLeaderEmail, password: password! }); await page.goto("/leader/weekly");
  const meeting = page.getByRole("button", { name: /· Scouts/ }).first();
  if (await meeting.count()) await meeting.click(); else { const history=page.getByTestId(/meeting-history-/).filter({hasText:"· Scouts"}).first(); await history.getByRole("link", { name: /View/ }).click(); }
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

  await loginAsLeader(page, { email: sectionLeaderEmail, password: password! });
  await ensureOpenScoutsMeeting(page);
  await expect(page.getByRole("heading", { name: "Weekly Meetings" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Menu · Weekly Meetings" })).toBeVisible();

  const meeting = page.getByRole("button", { name: /· Scouts/ }).first();
  await expect(meeting).toBeVisible();
  await meeting.click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=/);

  await expect(page.getByTestId("weekly-whatsapp-share")).toHaveAccessibleName("Share in WhatsApp");
  const actionPanel = page.getByTestId("weekly-meeting-editor-top");
  const backAction = page.getByRole("button", { name: "Back to Weekly Meetings", exact: true });
  for (const action of [
    backAction,
    page.getByRole("button", { name: "Create Meeting", exact: true }),
    page.getByRole("button", { name: "Equipment", exact: true }),
    page.getByTestId("weekly-whatsapp-share"),
    page.getByRole("button", { name: "Edit Meeting", exact: true }),
    page.getByRole("button", { name: "Copy Meeting", exact: true })
  ]) {
    await expectFilledAction(action);
  }
  expect(await actionPanel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  const viewportWidth = page.viewportSize()?.width ?? 0;
  for (const action of await actionPanel.getByRole("button").all()) {
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth + 1);
  }
  await page.keyboard.press("Tab");
  await backAction.focus();
  const focusVisible = await backAction.evaluate((element) => element.matches(":focus-visible") && getComputedStyle(element).outlineStyle !== "none" && Number.parseFloat(getComputedStyle(element).outlineWidth) >= 3);
  expect(focusVisible).toBe(true);

  await backAction.click();
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

  await loginAsLeader(page, { email: sectionLeaderEmail, password: password! });
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
