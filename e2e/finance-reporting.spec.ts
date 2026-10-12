import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Section Floats reporting checks run once on desktop Chromium.");
}

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(leaderEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("section leader sees permission-scoped Section Floats reporting and generated report actions", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page);
  await page.goto("/leader/reports");

  const panel = page.getByTestId("finance-reporting");
  await expect(panel.getByRole("heading", { name: "Section Floats reporting" })).toBeVisible();
  await expect(panel.getByRole("combobox", { name: "Section" })).toContainText("All permitted sections");
  await expect(panel.getByRole("combobox", { name: "Outgoing category" })).toContainText("All outgoing categories");
  const exportButton = panel.getByRole("button", { name: "Export Section Floats CSV" });
  await expect(exportButton).toBeVisible();
  await expect(panel.getByRole("button", { name: "Print / Save PDF" })).toBeVisible();

  if (await exportButton.isEnabled()) {
    await exportButton.click();
    const dialog = page.getByRole("dialog", { name: "Report ready" });
    await expect(dialog.getByRole("button", { name: "Open report" })).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Download report" })).toBeVisible();
    await dialog.getByRole("button", { name: "Keep working" }).click();
    await expect(page).toHaveURL(/\/leader\/reports$/);
  }
});

test("monthly float period labels stay readable without awkward wrapping on desktop and mobile", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Run monthly float layout checks on desktop and mobile Chromium.");
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page);
  await page.goto("/leader/reports");
  const panel = page.getByTestId("finance-reporting");
  await expect(panel.getByText("Monthly float movement", { exact: true })).toBeVisible();
  const buckets = panel.getByTestId("finance-month-bucket");
  for (const bucket of await buckets.all()) {
    const label = bucket.getByTestId("finance-month-label");
    await expect(label).toHaveText(/^(?:[A-Z][a-z]+ \d{4}|Month unavailable)$/);
    await expect(label).toHaveCSS("white-space", "nowrap");
    const dimensions = await label.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});
