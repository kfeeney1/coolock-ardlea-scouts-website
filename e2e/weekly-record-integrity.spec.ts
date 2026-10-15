import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Meeting integrity regressions run once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("Clear resets a new meeting form without creating a record", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure canonical E2E password.");
  await login(page, adminEmail);
  await page.goto("/leader/weekly/create");
  const section = page.getByRole("combobox", { name: "Section" });
  const originalSection = await section.textContent();
  await page.getByRole("textbox", { name: /^Meeting date/ }).fill("2099-04-01");
  await page.getByLabel("Location").fill("Temporary hall");
  await page.getByLabel("Theme / programme title").fill("Temporary theme");
  await page.getByLabel("Programme notes").fill("Temporary notes");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly\/create$/);
  await expect(section).toHaveText(originalSection || "");
  await expect(page.getByRole("textbox", { name: /^Meeting date/ })).not.toHaveValue("01-04-2099");
  await expect(page.getByLabel("Location")).toHaveValue("");
  await expect(page.getByLabel("Theme / programme title")).toHaveValue("");
  await expect(page.getByLabel("Programme notes")).toHaveValue("");
});

test("new meeting Cancel exits an untouched form without a discard prompt", async ({ page }) => {
  await login(page, adminEmail);
  await page.goto("/leader/weekly/create");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly$/);
  await expect(page.getByRole("dialog", { name: "Discard this new meeting?" })).toHaveCount(0);
});

test("new meeting Cancel saves valid entered data without creating an empty record", async ({ page }) => {
  await login(page, adminEmail);
  await page.goto("/leader/weekly/create");
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Scouts", exact: true }).click();
  await page.getByRole("textbox", { name: /^Meeting date/ }).fill("2099-04-04");
  await page.getByLabel("Location").fill("TEST cancelled meeting location");
  await page.getByLabel("Theme / programme title").fill("TEST saved on navigation");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly$/);
  const savedMeeting = page.getByRole("button", { name: /04-04-2099 · Scouts/ }).first();
  await expect(savedMeeting).toBeVisible();
  await savedMeeting.click();
  await page.getByRole("button", { name: "Programme", exact: true }).click();
  await expect(page.getByLabel("Location")).toHaveValue("TEST cancelled meeting location");
  await expect(page.getByLabel("Theme")).toHaveValue("TEST saved on navigation");
});

test("browser Back saves an edited meeting before returning to the previous page", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure canonical E2E password.");
  await login(page, adminEmail);
  await page.goto("/leader/weekly");
  await page.getByRole("link", { name: "Create Meeting", exact: true }).click();
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Scouts", exact: true }).click();
  await page.getByRole("textbox", { name: /^Meeting date/ }).fill("2099-04-09");
  await page.getByLabel("Theme / programme title").fill("TEST browser back autosave");
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=/);
  const meetingId = new URL(page.url()).searchParams.get("meeting");
  const savedTheme = "TEST browser back autosave updated";
  await page.getByRole("button", { name: "Programme", exact: true }).click();
  await page.getByLabel("Theme").fill(savedTheme);
  await page.goBack();
  await expect(page).toHaveURL(/\/leader\/weekly\/create$/);
  await page.goto(`/leader/weekly?meeting=${encodeURIComponent(meetingId ?? "")}`);
  await page.getByRole("button", { name: "Programme", exact: true }).click();
  await expect(page.getByLabel("Theme")).toHaveValue(savedTheme);
});

test("meeting copy Cancel exits untouched and protects a changed destination date", async ({ page }) => {
  await login(page, adminEmail);
  await page.goto("/leader/weekly");
  const sourceMeeting = page.getByTestId("meeting-history-TEST_e2e_weekly_scout");
  await expect(sourceMeeting).toBeVisible();
  await expect(page.getByTestId("weekly-history-result-count")).toBeVisible();
  const destinationMeetings = page.getByText(/08-04-2099 · Scouts/);
  const existingDestinationCount = await destinationMeetings.count();
  const copyLink = sourceMeeting.getByRole("link", { name: "Copy Meeting", exact: true });
  await copyLink.click();
  await expect(page).toHaveURL(/\/leader\/weekly\/copy\/TEST_e2e_weekly_scout$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel copy", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=TEST_e2e_weekly_scout$/);

  await page.goto("/leader/weekly");
  await sourceMeeting.getByRole("link", { name: "Copy Meeting", exact: true }).click();
  const copyDate = page.getByRole("textbox", { name: /^Choose date/ });
  await expect(copyDate).toBeVisible();
  await copyDate.fill("08-04-2099");
  await page.getByRole("button", { name: "Cancel copy", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Discard this new meeting copy?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(copyDate).toHaveValue("08-04-2099");
  await page.getByRole("button", { name: "Cancel copy", exact: true }).click();
  await page.getByRole("button", { name: "Discard and cancel", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=TEST_e2e_weekly_scout$/);
  await expect(page.getByText("Meeting copied.")).toHaveCount(0);
  await page.goto("/leader/weekly");
  await expect(destinationMeetings).toHaveCount(existingDestinationCount);
});

test("multi-role Group Leader meeting round-trips completely when reopened by Super Admin", async ({ page, browser }) => {
  await login(page, "test.group.leader@example.com");
  await page.goto("/leader/weekly/create");
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Cubs", exact: true }).click();
  await page.getByRole("textbox", { name: /^Meeting date/ }).fill("2099-04-03");
  await page.getByLabel("Location").fill("Cub Den");
  await page.getByLabel("Theme / programme title").fill("Cross-role hydration");
  await page.getByLabel("Programme notes").fill("Created by Group Leader with Cub appointment.");
  await page.getByRole("button", { name: "Create Meeting", exact: true }).click();
  await expect(page.getByTestId("weekly-meeting-editor-top")).toContainText("Cubs");
  await page.getByRole("button", { name: "Programme", exact: true }).click();
  await page.getByLabel("Activity 1", { exact: true }).fill("Multi-role game");
  const creatorLeader = page.getByTestId("activity-plan-row").first().getByRole("checkbox", { name: "Declan O'Connor · Scouter", exact: true });
  await expect(creatorLeader).toBeVisible();
  await creatorLeader.check();
  await page.getByLabel("Equipment 1", { exact: true }).fill("Cones");
  await page.getByLabel("Instructions / notes 1", { exact: true }).fill("Persist this nested activity.");
  await page.getByLabel("Badgework 1", { exact: true }).fill("Teamwork");
  await page.getByRole("button", { name: "Save Meeting", exact: true }).click();
  await expect(page.getByText("Meeting saved.")).toBeVisible();
  const meetingUrl = page.url();

  const superContext = await browser.newContext();
  const superPage = await superContext.newPage();
  await login(superPage, "superadmin@example.com");
  await superPage.goto(meetingUrl);
  await expect(superPage.getByTestId("weekly-meeting-editor-top")).toContainText("Cubs");
  await superPage.getByRole("button", { name: "Programme", exact: true }).click();
  await expect(superPage.getByLabel("Theme")).toHaveValue("Cross-role hydration");
  await expect(superPage.getByLabel("Location")).toHaveValue("Cub Den");
  await expect(superPage.getByLabel("Programme notes")).toHaveValue("Created by Group Leader with Cub appointment.");
  await expect(superPage.getByLabel("Activity 1", { exact: true })).toHaveValue("Multi-role game");
  await expect(superPage.getByLabel("Equipment 1", { exact: true })).toHaveValue("Cones");
  await expect(superPage.getByLabel("Instructions / notes 1", { exact: true })).toHaveValue("Persist this nested activity.");
  await expect(superPage.getByTestId("activity-plan-row").first().getByRole("checkbox", { name: "Declan O'Connor · Scouter", exact: true })).toBeChecked();
  await expect(superPage.getByLabel("Badgework 1", { exact: true })).toHaveValue("Teamwork");
  await superPage.reload();
  await superPage.getByRole("button", { name: "Programme", exact: true }).click();
  await expect(superPage.getByLabel("Theme")).toHaveValue("Cross-role hydration");
  await expect(superPage.getByLabel("Activity 1", { exact: true })).toHaveValue("Multi-role game");
  await superContext.close();
});
