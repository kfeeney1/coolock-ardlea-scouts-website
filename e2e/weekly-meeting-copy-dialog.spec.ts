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

test("SW-386 Copy Meeting uses a dedicated full page on desktop and mobile", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Run on desktop and mobile Chromium.");
  test.skip(!password, "Configure canonical E2E credentials.");
  await page.setViewportSize(testInfo.project.name === "mobile-chromium" ? { width: 320, height: 844 } : { width: 1280, height: 800 });
  await login(page);
  await page.goto("/leader/weekly");
  const source = page.getByTestId(/meeting-history-/).filter({ hasText: "· Scouts" }).first();
  await expect(source).toBeVisible();
  const id = (await source.getAttribute("data-testid"))!.replace("meeting-history-", "");
  const copyLink = source.getByRole("link", { name: "Copy Meeting", exact: true });
  await expect(copyLink).toHaveAttribute("href", `/leader/weekly/copy/${encodeURIComponent(id)}`);
  await copyLink.click();
  await expect(page).toHaveURL(new RegExp(`/leader/weekly/copy/${id}$`));
  await expect(page.getByRole("heading", { name: "Copy Weekly Meeting" })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("copy-attendance-preview")).toContainText("Attendance preview · Scouts");
  await expect(page.getByRole("combobox", { name: "Destination section" })).toBeVisible();
  await expect(page.getByLabel("Choose date")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  await page.getByRole("button", { name: "Cancel copy" }).click();
  await expect(page).toHaveURL(new RegExp(`/leader/weekly\\?meeting=${id}$`));
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
