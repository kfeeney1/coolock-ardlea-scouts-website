import { expect, test, type Page } from "@playwright/test";

const leaderEmail = process.env.E2E_LEADER_EMAIL;
const leaderPassword = process.env.E2E_LEADER_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
const parentEmail = process.env.E2E_PARENT_EMAIL;
const parentPassword = process.env.E2E_TEST_USER_PASSWORD;

async function expectAccessibilityBaseline(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("lang", /.+/);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator("h1")).toHaveCount(1);

  const missingAlt = await page.locator("img:visible").evaluateAll((images) =>
    images
      .filter((image) => !image.hasAttribute("alt"))
      .map((image) => image.getAttribute("src") || "<inline image>")
  );
  expect(missingAlt, "Visible images must declare alt text; decorative images should use alt=\"\".").toEqual([]);

  const unnamedControls = await page
    .locator("button:visible, a[href]:visible, input:visible, select:visible, textarea:visible")
    .evaluateAll((elements) =>
      elements
        .filter((element) => {
          const htmlElement = element as HTMLElement;
          if (htmlElement.getAttribute("aria-hidden") === "true" || htmlElement.getAttribute("tabindex") === "-1") {
            return false;
          }
          const ariaLabel = htmlElement.getAttribute("aria-label")?.trim();
          const ariaLabelledBy = htmlElement.getAttribute("aria-labelledby")?.trim();
          const title = htmlElement.getAttribute("title")?.trim();
          const text = htmlElement.innerText?.trim();
          const input = htmlElement as HTMLInputElement;
          const labels = "labels" in input && input.labels ? Array.from(input.labels).map((label) => label.textContent?.trim()).filter(Boolean) : [];
          const alt = input.getAttribute("alt")?.trim();
          const value = input.type === "submit" || input.type === "button" ? input.value?.trim() : "";
          return !ariaLabel && !ariaLabelledBy && !title && !text && labels.length === 0 && !alt && !value;
        })
        .map((element) => {
          const htmlElement = element as HTMLElement;
          return `${htmlElement.tagName.toLowerCase()}${htmlElement.id ? `#${htmlElement.id}` : ""}${htmlElement.getAttribute("href") ? `[href=${htmlElement.getAttribute("href")}]` : ""}`;
        })
    );
  expect(unnamedControls, "Visible user-interactive controls must have an accessible name.").toEqual([]);

  await page.locator("body").focus();
  await page.keyboard.press("Tab");
  const focused = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return active ? { tag: active.tagName.toLowerCase(), disabled: active.hasAttribute("disabled"), hidden: active.getAttribute("aria-hidden") === "true" } : null;
  });
  expect(focused, "Keyboard Tab should move focus into the page.").not.toBeNull();
  expect(focused?.tag).not.toBe("body");
  expect(focused?.disabled).toBe(false);
  expect(focused?.hidden).toBe(false);
}

async function loginLeader(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel(/email/i).fill(leaderEmail!);
  await page.getByLabel(/password/i).fill(leaderPassword!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/leader/);
}

async function loginParent(page: Page) {
  await page.goto("/parent");
  await page.getByLabel("Email").fill(parentEmail!);
  await page.getByLabel("Password").fill(parentPassword || "");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText(/Your account is approved and linked to 2 member records/i)).toBeVisible();
}

test.describe("accessibility baseline", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Accessibility baseline runs once on desktop Chromium.");
  });

  for (const route of ["/", "/about", "/join", "/contact"]) {
    test(`public route ${route} has baseline accessible structure`, async ({ page }) => {
      await page.goto(route);
      await expectAccessibilityBaseline(page);
    });
  }

  test("parent sign-in has baseline accessible structure", async ({ page }) => {
    await page.goto("/parent");
    await expectAccessibilityBaseline(page);
  });

  test("approved parent portal has baseline accessible structure", async ({ page }) => {
    test.skip(!parentEmail || !parentPassword, "Canonical parent E2E credentials are required.");
    await loginParent(page);
    await expectAccessibilityBaseline(page);
  });

  test("leader sign-in has baseline accessible structure", async ({ page }) => {
    await page.goto("/leader/login");
    await expectAccessibilityBaseline(page);
  });

  test("leader information page has baseline accessible structure", async ({ page }) => {
    test.skip(!leaderEmail || !leaderPassword, "Leader E2E credentials are required.");
    await loginLeader(page);
    await page.goto("/leader/info");
    await expect(page.getByRole("heading", { name: "Leader Portal Information" })).toBeVisible();
    await expectAccessibilityBaseline(page);
  });
});
