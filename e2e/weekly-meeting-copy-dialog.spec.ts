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

test("SW-363 Copy Meeting opens an accessible dialog in view and restores focus and scroll", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Copy dialog visibility runs at representative desktop and mobile sizes.");
  test.skip(!password, "Configure canonical E2E credentials.");
  const viewport = testInfo.project.name === "mobile-chromium" ? { width: 390, height: 844 } : { width: 1280, height: 800 };
  await page.setViewportSize(viewport);
  await login(page);
  await page.goto("/leader/weekly");

  const source = page.getByTestId(/meeting-history-/).filter({ hasText: "· Scouts" }).first();
  await expect(source).toBeVisible();
  const copyButton = source.getByRole("button", { name: "Copy Meeting", exact: true });
  await copyButton.scrollIntoViewIfNeeded();
  const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(pageHeight).toBeGreaterThan(viewport.height + 200);
  const scrollBefore = await page.evaluate(() => window.scrollY);

  await copyButton.click();
  const dialog = page.getByRole("dialog", { name: /Copy .*Scouts/ });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute("aria-labelledby", "copy-weekly-meeting-title");
  await expect(dialog.getByTestId("copy-attendance-preview")).toContainText("Attendance preview · Scouts");
  const destination = dialog.getByRole("combobox", { name: "Destination section" });
  await expect(destination).toBeFocused();

  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(copyButton).toBeFocused();
  const scrollAfter = await page.evaluate(() => window.scrollY);
  expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(3);
});
