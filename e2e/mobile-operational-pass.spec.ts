import { expect, test, type Locator, type Page } from "@playwright/test";

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_TEST_USER_PASSWORD;

const operationalRouteGroups = [
  ["programme", ["/leader/weekly", "/leader/events", "/leader/badgework"]],
  ["people and equipment", ["/leader/members", "/leader/equipment", "/leader/finance"]],
  ["records and reporting", ["/leader/meetings", "/leader/attendance", "/leader/reports"]]
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

async function dismissTopSurfaceWithBack(page: Page, surface: Locator) {
  await page.goBack();
  await expect(surface).toBeHidden({ timeout: 1_000 });
}

test.describe("Stage 20.6 mobile operational pass", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Stage 20.6 mobile baseline runs on the Pixel 7 project only.");
    test.skip(!adminEmail || !password, "Configure canonical E2E admin credentials.");
  });

  for (const [area, routes] of operationalRouteGroups) {
    test(`${area} workflows remain viewport-safe on Pixel 7`, async ({ page }) => {
      await loginAdmin(page);

      for (const route of routes) {
        await test.step(route, async () => {
          await page.goto(route);
          await expectMobileViewportSafe(page, route);
        });
      }
    });
  }

  test("expanded leader navigation remains viewport-safe on a feature page", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/leader/weekly");
    const menu = page.getByRole("button", { name: /Menu · Weekly Meetings|Open Leader Menu/ });
    await menu.click();
    await expect(page.getByRole("navigation", { name: "Leader navigation" })).toBeVisible();
    await expectMobileViewportSafe(page, "/leader/weekly#leader-navigation");
  });

  test("Weekly Meetings keeps keyboard input and sticky actions usable while scrolling", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/leader/weekly");

    const historyCard = page.getByTestId(/meeting-history-/).first();
    await expect(historyCard).toBeVisible();
    await historyCard.getByRole("button", { name: "View / Edit", exact: true }).click();
    await page.getByRole("button", { name: "Notes", exact: true }).click();

    const notes = page.getByLabel("Additional meeting notes");
    const actions = page.getByTestId("weekly-sticky-actions");
    await notes.fill("Mobile regression draft — do not save");
    await expect(notes).toBeFocused();
    await expect(actions).toBeVisible();
    await expectMobileViewportSafe(page, "/leader/weekly#notes");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const [notesBox, actionsBox] = await Promise.all([notes.boundingBox(), actions.boundingBox()]);
    expect(notesBox).not.toBeNull();
    expect(actionsBox).not.toBeNull();
    expect(notesBox!.y + notesBox!.height).toBeLessThanOrEqual(actionsBox!.y);
    expect(actionsBox!.y + actionsBox!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  });

  test("member and attendance records preserve the mobile record-to-detail-to-Back flow", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/leader/members");

    const memberCard = page.locator('[data-testid^="member-card-"]').first();
    await expect(memberCard).toBeVisible();
    await memberCard.click({ position: { x: 20, y: 20 } });
    await expect(page).toHaveURL(/\/leader\/members\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Member Details" })).toBeVisible();
    await expectMobileViewportSafe(page, "/leader/members/:memberId");

    await page.goBack();
    await expect(page).toHaveURL(/\/leader\/members$/);
    await expect(memberCard).toBeVisible();

    await page.goto("/leader/attendance");
    const search = page.getByLabel("Search members");
    await search.fill("Casey OBrien Scouts 01");
    await expect(search).toBeFocused();
    const attendanceCard = page.getByTestId("attendance-member-card");
    await expect(attendanceCard).toHaveCount(1);
    await attendanceCard.getByRole("button", { name: "View attendance" }).click();
    await expect(page.getByTestId("attendance-member-detail")).toBeVisible();
    await expectMobileViewportSafe(page, "/leader/attendance#member-detail");
    await page.getByRole("button", { name: "Back to members" }).click();
    await expect(search).toHaveValue("Casey OBrien Scouts 01");
  });

  test("equipment and finance forms keep nested selects, Back and keyboards inside the viewport", async ({ page }) => {
    await loginAdmin(page);
    await page.goto("/leader/equipment");

    await page.getByRole("button", { name: "Add equipment" }).click();
    const equipmentDialog = page.getByRole("dialog", { name: "Add equipment" });
    await expect(equipmentDialog).toBeVisible();
    await equipmentDialog.getByLabel("Equipment name").fill("Unsaved mobile regression item");
    await equipmentDialog.getByRole("combobox").first().click();
    const categoryListbox = page.getByRole("listbox");
    await expect(categoryListbox).toBeVisible();
    await expectMobileViewportSafe(page, "/leader/equipment#category-listbox");
    await dismissTopSurfaceWithBack(page, categoryListbox);
    await expect(equipmentDialog).toBeVisible();
    await dismissTopSurfaceWithBack(page, equipmentDialog);
    await expect(page).toHaveURL(/\/leader\/equipment$/);

    await page.goto("/leader/finance");
    const transaction = page.getByRole("combobox", { name: "Transaction" });
    await transaction.click();
    const transactionListbox = page.getByRole("listbox");
    await expect(transactionListbox).toBeVisible();
    await expectMobileViewportSafe(page, "/leader/finance#transaction-listbox");
    await dismissTopSurfaceWithBack(page, transactionListbox);
    const amount = page.getByLabel("Amount (€)");
    await amount.fill("12.34");
    await expect(amount).toBeFocused();
    await expect(amount).toHaveValue("12.34");
    await expect(page.getByRole("button", { name: "Attach receipt" })).toBeVisible();
    await expectMobileViewportSafe(page, "/leader/finance#transaction-form");
  });
});
