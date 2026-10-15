import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com";

test("SW-400 Copy Meeting link targets the encoded source id", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Check the source link on desktop and mobile Chromium.");
  test.skip(!password, "Configure canonical E2E credentials.");
  await page.setViewportSize(testInfo.project.name === "mobile-chromium" ? { width: 320, height: 844 } : { width: 1280, height: 800 });
  await loginAsLeader(page, { email: adminEmail, password: password! });
  await page.goto("/leader/weekly");

  const source = page.getByTestId(/meeting-history-/).filter({ hasText: "· Scouts" }).first();
  await expect(source).toBeVisible();
  const sourceId = (await source.getAttribute("data-testid"))!.replace("meeting-history-", "");
  await expect(source.getByRole("link", { name: "Copy Meeting", exact: true }))
    .toHaveAttribute("href", `/leader/weekly/copy/${encodeURIComponent(sourceId)}`);
});
