import { expect, type Browser } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com";
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";

export async function setParentConsentEnabled(browser: Browser, enabled: boolean): Promise<void> {
  if (!password) throw new Error("Configure E2E_TEST_USER_PASSWORD to manage Parent Portal consent settings.");
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  try {
    await page.goto("/leader/login");
    await page.getByLabel("Email address").fill(superAdminEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
    await page.goto("/leader/settings");
    const setting = page.getByRole("switch", { name: "Enable Parent Portal Consent and Medical Consent" });
    await expect(setting).toBeVisible();
    if ((await setting.isChecked()) !== enabled) {
      await setting.click();
      await expect(page.getByRole("status").filter({ hasText: `Parent Portal Consent and Medical Consent ${enabled ? "enabled" : "disabled"}` })).toBeVisible();
    }
    await expect(setting).toHaveJSProperty("checked", enabled);
  } finally {
    await context.close();
  }
}
