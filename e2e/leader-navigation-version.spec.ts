import { expect, test, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
const superEmail = process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com";
async function selectVersion(page: Page, version: "Existing" | "Redesigned") {
  await page.goto("/leader/settings");
  const button = page.getByRole("button", { name: `${version} navigation`, exact: true });
  await expect(button).toBeEnabled();
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}
async function openMenu(page: Page) {
  const toggle = page.getByRole("button", { name: /Leader Menu|Menu ·/ });
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await expect(page.getByRole("navigation", { name: "Leader navigation" })).toBeVisible();
}
function navigationRoot(page: Page, redesigned: boolean, mobile: boolean) {
  return page.getByTestId(redesigned ? "leader-navigation-redesigned" : mobile ? "leader-navigation-mobile" : "leader-navigation-desktop");
}
async function expose(page: Page, category: string, redesigned: boolean, mobile: boolean) {
  await openMenu(page);
  const root = navigationRoot(page, redesigned, mobile);
  if (redesigned || mobile) {
    const toggle = root.getByRole("button", { name: category, exact: !redesigned });
    if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  }
  return root;
}
async function destinations(page: Page, redesigned: boolean, mobile: boolean, minimumCount = 30) {
  await openMenu(page);
  const root = navigationRoot(page, redesigned, mobile);
  const result: string[] = [];
  if (redesigned || mobile) {
    for (const category of await root.getByRole("button").all()) {
      if (await category.getAttribute("aria-expanded") !== "true") await category.click();
      const region = root.getByRole("region");
      await expect(region).toHaveCount(1);
      result.push(...await region.getByRole("link").evaluateAll((links) => links.map((link) => `${link.getAttribute("data-testid")}:${link.getAttribute("href")}`)));
    }
  } else {
    result.push(...await root.getByRole("link").evaluateAll((links) => links.map((link) => `${link.getAttribute("data-testid")}:${link.getAttribute("href")}`)));
  }
  expect(new Set(result).size).toBe(result.length);
  expect(result.length).toBeGreaterThan(minimumCount);
  await page.keyboard.press("Escape");
  return result.sort();
}
test("Superuser persists both versions with complete menu parity, keyboard state and return links", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  const mobile = testInfo.project.name === "mobile-chromium";
  await loginAsLeader(page, { email: superEmail, password: password! });
  await page.goto("/leader/settings");
  await expect(page.getByRole("button", { name: "Existing navigation", exact: true })).toHaveAttribute("aria-pressed", "true");
  let baseline: string[] = [];
  try {
    for (const redesigned of [false, true]) {
      const mode = redesigned ? "Redesigned" : "Existing";
      await selectVersion(page, mode);
      await page.reload();
      await expect(page.getByRole("button", { name: `${mode} navigation`, exact: true })).toHaveAttribute("aria-pressed", "true");
      const actual = await destinations(page, redesigned, mobile);
      if (!redesigned) baseline = actual;
      else expect(actual).toEqual(baseline);
      await page.goto("/leader/qm-reports");
      await expect(page.getByTestId("page-qm-reports")).toBeVisible();
      const root = await expose(page, "Quartermaster / Bo’sun", redesigned, mobile);
      await expect(root.getByTestId("leader-nav-qm-reports")).toHaveAttribute("aria-current", "page");
      if (redesigned) {
        await page.screenshot({ path: testInfo.outputPath("redesigned-navigation.png"), fullPage: true });
        const toggle = root.getByRole("button", { name: /Programme/ });
        const history = await page.evaluate(() => window.history.length);
        await toggle.focus(); await page.keyboard.press("Enter");
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(root.getByRole("region", { name: /Quartermaster/ })).toHaveCount(0);
        expect(await page.evaluate(() => window.history.length)).toBe(history);
      }
      await page.keyboard.press("Escape");
      await expect(page.getByRole("navigation", { name: "Leader navigation" })).toBeHidden();
      await page.getByRole("link", { name: "Back to Equipment & Stores", exact: true }).click();
      await expect(page).toHaveURL(/\/leader\/equipment\?view=quartermaster$/);
      await expect(page.getByTestId("page-qm-equipment-stores")).toBeVisible();
    }
  } finally { await selectVersion(page, "Existing"); }
});
