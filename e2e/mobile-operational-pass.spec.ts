import { expect, test, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_TEST_USER_PASSWORD;

const operationalRoutes = [
  "/leader/weekly",
  "/leader/events",
  "/leader/badgework",
  "/leader/members",
  "/leader/equipment",
  "/leader/finance",
  "/leader/meetings",
  "/leader/attendance",
  "/leader/reports"
] as const;

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(adminEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function expectMobileViewportSafe(page: Page, route: string) {
  await expect(page.getByTestId("leader-dashboard-header")).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    return {
      viewportWidth,
      documentFitsViewport: document.documentElement.scrollWidth <= viewportWidth + 1,
      bodyFitsViewport: document.body.scrollWidth <= viewportWidth + 1
    };
  }), { message: `${route} must not introduce page-level horizontal overflow` }).toEqual({
    viewportWidth: 412,
    documentFitsViewport: true,
    bodyFitsViewport: true
  });

  const escapedSurfaces = await page.locator("body *").evaluateAll((elements) => {
    const viewportWidth = window.innerWidth;
    return elements.flatMap((element) => {
      const htmlElement = element as HTMLElement;
      const style = window.getComputedStyle(htmlElement);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return [];
      if (style.position !== "fixed" && style.position !== "sticky") return [];
      const rect = htmlElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return [];
      if (rect.left >= -1 && rect.right <= viewportWidth + 1) return [];
      return [{
        tag: htmlElement.tagName.toLowerCase(),
        id: htmlElement.id,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        position: style.position
      }];
    });
  });
  expect(escapedSurfaces, `${route} fixed/sticky controls must remain inside the phone viewport`).toEqual([]);
}

test.describe("Stage 20.6 mobile operational pass", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Stage 20.6 mobile baseline runs on the Pixel 7 project only.");
    test.skip(!adminEmail || !password, "Configure canonical E2E admin credentials.");
  });

  test("high-frequency leader workflows remain viewport-safe on Pixel 7", async ({ page }) => {
    await loginAdmin(page);

    for (const route of operationalRoutes) {
      await page.goto(route);
      await expectMobileViewportSafe(page, route);
    }
  });

  test("expanded leader navigation remains viewport-safe on a feature page", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/leader/weekly");
    const menu = page.getByRole("button", { name: /Menu · Weekly Meetings|Open Leader Menu/ });
    await menu.click();
    await expect(page.getByRole("navigation", { name: "Leader navigation" })).toBeVisible();
    await expectMobileViewportSafe(page, "/leader/weekly#leader-navigation");
  });
});
