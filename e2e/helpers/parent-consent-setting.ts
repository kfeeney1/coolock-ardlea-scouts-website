import { expect, type Browser } from "@playwright/test";
import { open, stat, unlink } from "node:fs/promises";

const password = process.env.E2E_TEST_USER_PASSWORD;
const superAdminEmail = process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com";
const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const consentSettingLockPath = "/tmp/coolock-parent-consent-setting.lock";

/** Serialize tests that change this shared emulator-backed site setting. */
export async function acquireParentConsentSettingLock(): Promise<() => Promise<void>> {
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    try {
      const lock = await open(consentSettingLockPath, "wx");
      await lock.writeFile(`${process.pid}\n`);
      return async () => {
        await lock.close();
        await unlink(consentSettingLockPath).catch(() => undefined);
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        const lockStat = await stat(consentSettingLockPath);
        if (Date.now() - lockStat.mtimeMs > 30 * 60 * 1000) {
          await unlink(consentSettingLockPath).catch(() => undefined);
          continue;
        }
      } catch (statError) {
        if ((statError as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw statError;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error("Timed out waiting for the shared Parent Portal consent setting lock.");
}

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
      const saveError = page.getByRole("alert").filter({ hasText: /Unable to save Parent Portal consent settings/i });
      await expect.poll(async () => (await setting.isChecked()) === enabled || (await saveError.count()) > 0, {
        message: `Parent Portal consent setting did not reach ${enabled ? "enabled" : "disabled"} state.`
      }).toBe(true);
      if (await saveError.count()) {
        throw new Error(`Unable to update Parent Portal consent setting: ${(await saveError.first().innerText()).trim()}`);
      }
    }
    await expect(setting).toHaveJSProperty("checked", enabled);
  } finally {
    await context.close();
  }
}
