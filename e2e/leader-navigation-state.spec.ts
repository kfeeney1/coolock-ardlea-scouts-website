import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
const email = process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com";
async function mode(page: Page, redesigned: boolean) {
  await page.goto("/leader/settings");
  const button = page.getByRole("button", { name: `${redesigned ? "Redesigned" : "Existing"} navigation`, exact: true });
  await expect(button).toBeEnabled();
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}
async function open(page: Page) {
  await page.locator('button[aria-controls="leader-navigation"]').click();
  await expect(page.getByRole("navigation", { name: "Leader navigation", exact: true })).toBeVisible();
}
for (const redesigned of [false, true]) {
  test(`${redesigned ? "Redesigned" : "Existing"} route state survives filters, fragments, aliases and reload`, async ({ page }, testInfo) => {
    test.skip(!password, "Configure canonical E2E credentials.");
    await loginAsLeader(page, { email, password: password! });
    const mobile = testInfo.project.name === "mobile-chromium";
    const root = page.getByTestId(redesigned ? "leader-navigation-redesigned" : mobile ? "leader-navigation-mobile" : "leader-navigation-desktop");
    const cases = [
      { path: "/leader/reports?section=Cubs&view=treasurer", id: "treasurer-reports", category: "treasurer", label: "Treasurer", testId: "page-treasurer-reports" },
      { path: "/leader/settings?section=Cubs&view=quartermaster", id: "qm-settings", category: "quartermaster", label: "Quartermaster / Bo’sun", testId: "page-qm-settings" },
      { path: "/leader/subs?section=Cubs#family-billing", id: "family-billing", category: "people-parents", label: "People & Parents", testId: "page-subs" },
      { path: "/leader/member-history", id: "member-management", category: "people-parents", label: "People & Parents", testId: "page-member-management" }
    ];
    try {
      await mode(page, redesigned);
      for (const entry of cases) {
        await page.goto(entry.path);
        if (entry.path === "/leader/member-history") await expect(page).toHaveURL(/\/leader\/members$/);
        else await expect(page).toHaveURL(new URL(entry.path, process.env.E2E_BASE_URL || "http://127.0.0.1:4173").href);
        await expect(page.getByTestId(entry.testId)).toBeVisible();
        for (const reload of [false, true]) {
          if (reload) { await page.reload(); await expect(page.getByTestId(entry.testId)).toBeVisible(); }
          await open(page);
          // Do not manually expand: route state must open the right parent.
          if (redesigned || mobile) {
            const toggle = redesigned ? root.locator(`button[aria-controls="redesigned-${entry.category}-panel"]`) : root.getByRole("button", { name: entry.label, exact: true });
            await expect(toggle).toHaveAttribute("aria-expanded", "true");
            await expect(root.locator('button[aria-expanded="true"]')).toHaveCount(1);
          }
          await expect(root.getByTestId(`leader-nav-${entry.id}`)).toHaveAttribute("aria-current", "page");
          await expect(root.locator('[aria-current="page"]')).toHaveCount(1);
          await page.keyboard.press("Escape");
        }
      }
    } finally { await mode(page, false); }
  });
}
