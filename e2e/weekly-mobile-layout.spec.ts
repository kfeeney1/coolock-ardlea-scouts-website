import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const sectionLeaderEmail = process.env.E2E_SECTION_LEADER_EMAIL || "test.scout.section.leader@example.com";

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(sectionLeaderEmail);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("mobile Weekly Meetings keeps editable content clear of sticky save actions", async ({ page }, testInfo: TestInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Mobile layout regression runs once on Chromium.");
  test.skip(!password, "Configure canonical E2E leader credentials.");
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await page.goto("/leader/weekly");
  await expect(page.getByRole("heading", { name: "Weekly Meetings" })).toBeVisible();

  const historyCard = page.getByTestId(/meeting-history-/).first();
  await expect(historyCard).toBeVisible();
  await historyCard.getByRole("button", { name: "View / Edit", exact: true }).click();

  await page.getByRole("button", { name: "Notes", exact: true }).click();
  const notes = page.getByLabel("Additional meeting notes");
  const actions = page.getByTestId("weekly-sticky-actions");
  await expect(notes).toBeVisible();
  await expect(actions).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const notesBox = await notes.boundingBox();
  const actionsBox = await actions.boundingBox();
  expect(notesBox).not.toBeNull();
  expect(actionsBox).not.toBeNull();
  expect(notesBox!.y + notesBox!.height).toBeLessThanOrEqual(actionsBox!.y);
  expect(actionsBox!.y + actionsBox!.height).toBeLessThanOrEqual(844);
});
