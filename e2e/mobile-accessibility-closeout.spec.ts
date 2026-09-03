import { expect, test, type Page, type TestInfo } from "@playwright/test";

const leaderEmail = process.env.E2E_LEADER_EMAIL;
const leaderPassword = process.env.E2E_LEADER_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL;
const parentPassword = process.env.E2E_TEST_USER_PASSWORD;

function mobileOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "mobile-chromium", "Stage 10 mobile close-out runs on the Pixel 7 project.");
}

async function expectNoHorizontalPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth
  }));
  expect(dimensions.document, "Document must fit within the mobile viewport.").toBeLessThanOrEqual(dimensions.viewport + 1);
  expect(dimensions.body, "Body must fit within the mobile viewport.").toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function expectMobileAccessibilityBaseline(page: Page) {
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);

  const unnamedControls = await page
    .locator("button:visible, a[href]:visible, input:visible, select:visible, textarea:visible")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const control = element as HTMLElement;
          if (control.getAttribute("aria-hidden") === "true" || control.getAttribute("tabindex") === "-1") return false;
          const input = control as HTMLInputElement;
          const labels = "labels" in input && input.labels ? Array.from(input.labels).some((label) => Boolean(label.textContent?.trim())) : false;
          return !control.getAttribute("aria-label")?.trim()
            && !control.getAttribute("aria-labelledby")?.trim()
            && !control.getAttribute("title")?.trim()
            && !control.innerText?.trim()
            && !labels
            && !input.getAttribute("alt")?.trim()
            && !((input.type === "submit" || input.type === "button") && input.value?.trim());
        })
        .map((element) => element.outerHTML.slice(0, 160))
    );
  expect(unnamedControls, "Visible mobile controls must have accessible names.").toEqual([]);
}

async function loginLeader(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel(/email/i).fill(leaderEmail!);
  await page.getByLabel(/password/i).fill(leaderPassword!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function loginParent(page: Page) {
  await page.goto("/parent");
  await page.getByLabel("Email").fill(parentEmail!);
  await page.getByLabel("Password").fill(parentPassword!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText(/Your account is approved and linked to 2 member records/i)).toBeVisible();
}

test.describe("Stage 10 mobile and accessibility close-out", () => {
  test("public pages remain usable without horizontal overflow", async ({ page }, testInfo) => {
    mobileOnly(testInfo);
    for (const route of ["/", "/about", "/join", "/contact", "/parent", "/leader/login"]) {
      await page.goto(route);
      await expectNoHorizontalPageOverflow(page);
      await expectMobileAccessibilityBaseline(page);
    }
  });

  test("approved parent dashboard and consent form fit phone width", async ({ page }, testInfo) => {
    mobileOnly(testInfo);
    test.skip(!parentEmail || !parentPassword, "Canonical parent E2E credentials are required.");
    await loginParent(page);
    await expectNoHorizontalPageOverflow(page);
    await expectMobileAccessibilityBaseline(page);

    const consentTile = page.getByTestId("parent-consent-tile-TEST_member_beaver_01");
    await consentTile.getByRole("button", { name: "Review Consent" }).click();
    await expect(page.getByRole("button", { name: "Save Consent & Medical Details" })).toBeVisible();
    await expectNoHorizontalPageOverflow(page);
    await expectMobileAccessibilityBaseline(page);
  });

  test("leader menu and core Stage 10 pages fit phone width", async ({ page }, testInfo) => {
    mobileOnly(testInfo);
    test.skip(!leaderEmail || !leaderPassword, "Leader E2E credentials are required.");
    await loginLeader(page);
    await expectNoHorizontalPageOverflow(page);

    const menuButton = page.getByRole("button", { name: /(Leader Menu|Menu ·)/ });
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await page.getByRole("navigation", { name: "Leader navigation" }).getByRole("button", { name: "Programme" }).click();
    await expect(page.getByRole("link", { name: "Weekly Meetings", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Events & Activities", exact: true })).toBeVisible();

    const corePages = [
      { route: "/leader/weekly", heading: "Weekly Meetings" },
      { route: "/leader/events", heading: "Events & Activities" },
      { route: "/leader/attendance", heading: "Attendance History & Insights" },
      { route: "/leader/reports", heading: "Reports" },
      { route: "/leader/info", heading: "Leader Portal Information" }
    ];

    for (const { route, heading } of corePages) {
      await page.goto(route);
      await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
      await expectNoHorizontalPageOverflow(page);
      await expectMobileAccessibilityBaseline(page);
    }
  });
});
