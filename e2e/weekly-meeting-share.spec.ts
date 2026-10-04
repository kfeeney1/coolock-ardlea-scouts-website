import { expect, test } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;

async function login(page: import("@playwright/test").Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(adminEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("SW-290 mobile WhatsApp share includes meeting Badgework", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "SW-290 share regression runs on the canonical mobile project.");
  test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");
  await login(page);
  await page.goto("/leader/weekly");
  const meeting = page.getByTestId(/meeting-history-/).filter({ hasText: "· Scouts" }).first();
  await expect(meeting).toBeVisible();
  await meeting.getByRole("button", { name: /View/ }).click();

  const share = page.getByTestId("weekly-whatsapp-share");
  await expect(share).toBeEnabled();
  const href = await share.getAttribute("href");
  expect(href).toBeTruthy();
  const text = decodeURIComponent(href!.split("?text=")[1] ?? "");
  expect(text).toContain("Scouts Weekly Meeting ·");
  expect(text).toContain("Activities / Games:");
  expect(text).toContain("Badgework:");
  expect(text).toMatch(/Badgework:\n• .+/);
  expect(text).not.toMatch(/memberAdventureSkillProgress|weeklyMeetings\//);
});
