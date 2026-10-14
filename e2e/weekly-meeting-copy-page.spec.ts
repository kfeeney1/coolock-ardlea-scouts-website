import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com";

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(adminEmail);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("SW-386 Copy Meeting opens a full page and returns to its source without creating a copy", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Copy Meeting page runs at representative desktop and mobile sizes.");
  test.skip(!password, "Configure canonical E2E credentials.");
  const viewport = testInfo.project.name === "mobile-chromium" ? { width: 320, height: 844 } : { width: 1280, height: 800 };
  await page.setViewportSize(viewport);
  await login(page);
  await page.goto("/leader/weekly");

  const source = page.getByTestId(/meeting-history-/).filter({ hasText: "· Scouts" }).first();
  await expect(source).toBeVisible();
  await expect(page.getByTestId("weekly-history-result-count")).toBeVisible();
  const sourceId = (await source.getAttribute("data-testid"))!.replace("meeting-history-", "");
  await source.getByRole("link", { name: "Copy Meeting", exact: true }).click();

  await expect(page).toHaveURL(`/leader/weekly/copy/${sourceId}`);
  const copyPage = page.getByTestId("weekly-meeting-copy-page");
  await expect(copyPage).toBeVisible();
  await expect(page.getByRole("heading", { name: "Copy Weekly Meeting" })).toBeAttached();
  await expect(copyPage.getByRole("heading", { name: /Copy .*Scouts/ })).toBeVisible();
  await expect(page.getByRole("dialog", { name: /Copy .*Scouts/ })).toHaveCount(0);
  const destination = page.getByRole("combobox", { name: "Destination section" });
  await expect(destination).toHaveText("Scouts");
  await expect(copyPage.getByTestId("copy-attendance-preview")).toContainText("Attendance preview · Scouts");
  expect(await copyPage.getByTestId("copy-attendance-preview").evaluate((element) => element.scrollHeight <= element.clientHeight + 1)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
  const bounds = await copyPage.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);

  await page.getByRole("button", { name: "Cancel copy", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=/);
  await expect(page.getByTestId(`meeting-history-${sourceId}`)).toBeVisible();

  await page.getByTestId(`meeting-history-${sourceId}`).getByRole("link", { name: "Copy Meeting", exact: true }).click();
  await expect(page).toHaveURL(`/leader/weekly/copy/${sourceId}`);
  const copyDate = page.getByLabel("Choose date");
  await copyDate.fill("2099-04-08");
  await page.getByRole("button", { name: "Cancel copy", exact: true }).click();
  const discard = page.getByRole("dialog", { name: "Discard this new meeting copy?" });
  await expect(discard).toBeVisible();
  await discard.getByRole("button", { name: "Keep editing" }).click();
  await expect(copyDate).toHaveValue("2099-04-08");
  await page.getByRole("button", { name: "Back to Source Meeting" }).click();
  await expect(discard).toBeVisible();
  await discard.getByRole("button", { name: "Discard and cancel" }).click();
  await expect(page).toHaveURL(/\/leader\/weekly\?meeting=/);
  await expect(page.getByTestId(`meeting-history-${sourceId}`)).toBeVisible();
});

test("SW-386 browser Back returns to the source meeting context", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Verify browser and Android-style Back on desktop and mobile Chromium.");
  test.skip(!password, "Configure canonical E2E credentials.");
  await login(page);
  await page.goto("/leader/weekly");
  const source = page.getByTestId(/meeting-history-/).filter({ hasText: "· Scouts" }).first();
  await expect(source).toBeVisible();
  const sourceId = (await source.getAttribute("data-testid"))!.replace("meeting-history-", "");
  await source.getByRole("link", { name: "View / Edit", exact: true }).click();
  await expect(page).toHaveURL(`/leader/weekly?meeting=${sourceId}`);
  await page.getByRole("link", { name: "Copy Meeting", exact: true }).click();
  await expect(page).toHaveURL(`/leader/weekly/copy/${sourceId}`);
  await page.goBack();
  await expect(page).toHaveURL(`/leader/weekly?meeting=${sourceId}`);
  await expect(page.getByTestId("weekly-meeting-summary")).toContainText("Scouts");
});
