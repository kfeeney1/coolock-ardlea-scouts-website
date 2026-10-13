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
  await expect(panel.getByText(/transactions in the current Section Floats report\./)).toBeVisible();
  const buckets = panel.getByTestId("finance-month-bucket");
  for (const bucket of await buckets.all()) {
    const label = bucket.getByTestId("finance-month-label");
    await expect(label).toHaveText(/^(?:[A-Z][a-z]+ \d{4}|Month unavailable)$/);
    await expect(label).toHaveCSS("white-space", "nowrap");
    const dimensions = await label.evaluate((element) => ({ clientWidth: element.clientWidth, scrollWidth: element.scrollWidth }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});

test("Section Floats labels stay separate from default and selected filter values on desktop and mobile", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Run filter geometry checks on desktop and mobile Chromium.");
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page);
  await page.goto("/leader/reports");
  const panel = page.getByTestId("finance-reporting");

  const expectReadable = async (labelText: string, labelId: string, selectedText: string) => {
    const select = panel.getByRole("combobox", { name: labelText, exact: true });
    const label = panel.locator(`#${labelId}`);
    await expect(select).toContainText(selectedText);
    await expect(label).toHaveClass(/MuiInputLabel-shrink/);
    await expect(select).toHaveAttribute("aria-labelledby", new RegExp(labelId));
    const geometry = await select.evaluate((element, id) => {
      const inputLabel = document.getElementById(id);
      const display = element.querySelector<HTMLElement>(".MuiSelect-select");
      if (!inputLabel || !display) return null;
      const valueRange = document.createRange();
      valueRange.selectNodeContents(display);
      const labelBounds = inputLabel.getBoundingClientRect();
      const valueBounds = valueRange.getBoundingClientRect();
      const selectBounds = display.getBoundingClientRect();
      return {
        labelBottom: labelBounds.bottom,
        valueTop: valueBounds.top,
        selectWidth: selectBounds.width,
        selectClientWidth: display.clientWidth,
        selectScrollWidth: display.scrollWidth,
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth
      };
    }, labelId);
    expect(geometry).not.toBeNull();
    if (!geometry) throw new Error(`${labelText} label or selected value is missing`);
    expect(geometry.labelBottom).toBeLessThan(geometry.valueTop);
    expect(geometry.selectScrollWidth).toBeLessThanOrEqual(geometry.selectClientWidth);
    expect(geometry.selectWidth).toBeGreaterThan(0);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    return select;
  };

  let section = await expectReadable("Section", "finance-report-section-label", "All permitted sections");
  let category = await expectReadable("Outgoing category", "finance-report-category-label", "All outgoing categories");

  await section.click();
  await expect(section).toBeFocused();
  await page.keyboard.press("Escape");
  await section.blur();
  await expectReadable("Section", "finance-report-section-label", "All permitted sections");

  await section.click();
  const sectionOptions = (await page.getByRole("option").allTextContents()).map((value) => value.trim());
  const selectedSection = sectionOptions.find((value) => value && value !== "All permitted sections");
  expect(selectedSection).toBeTruthy();
  await page.getByRole("option", { name: selectedSection!, exact: true }).click();
  section = await expectReadable("Section", "finance-report-section-label", selectedSection!);

  await category.click();
  const categoryOptions = (await page.getByRole("option").allTextContents()).map((value) => value.trim());
  const selectedCategory = categoryOptions
    .filter((value) => value && value !== "All outgoing categories")
    .sort((left, right) => right.length - left.length)[0];
  expect(selectedCategory).toBeTruthy();
  await page.getByRole("option", { name: selectedCategory!, exact: true }).click();
  category = await expectReadable("Outgoing category", "finance-report-category-label", selectedCategory!);
  await category.blur();
  await expectReadable("Outgoing category", "finance-report-category-label", selectedCategory!);

  await panel.getByRole("button", { name: "Clear float filters", exact: true }).click();
  await expectReadable("Section", "finance-report-section-label", "All permitted sections");
  await expectReadable("Outgoing category", "finance-report-category-label", "All outgoing categories");
  await page.reload();
  await expectReadable("Section", "finance-report-section-label", "All permitted sections");
  await expectReadable("Outgoing category", "finance-report-category-label", "All outgoing categories");
});
