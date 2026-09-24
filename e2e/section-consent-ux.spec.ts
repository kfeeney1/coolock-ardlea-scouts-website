import { expect, test } from "@playwright/test";

test.describe("SW-121 / SW-120 section consent experience", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/activities/consent");
    await expect(page.getByTestId("consent-section-chooser")).toBeVisible();
  });

  test("renders official section identities with accessible section controls", async ({ page }) => {
    const sections = [
      { value: "Beavers", label: "Beavers" },
      { value: "Cubs", label: "Cubs" },
      { value: "Scouts", label: "Scouts" },
      { value: "Ventures", label: "Ventures" },
      { value: "Rovers", label: "Rover Scouts" }
    ];
    for (const section of sections) {
      const button = page.getByRole("button", { name: `Open ${section.label} consent form` });
      await expect(button).toHaveCount(1);
      await expect(button).toBeVisible();
      await expect(page.getByTestId(`official-section-symbol-${section.value.toLowerCase()}`)).toBeVisible();
      await expect(page.getByTestId(`official-section-symbol-${section.toLowerCase()}`)).toHaveAttribute(
        "data-icon-id",
        `official-one-programme-${section.value.toLowerCase()}`
      );
    }
  });

  test("selecting a section preserves the viewport and loads the form", async ({ page }) => {
    const button = page.getByRole("button", { name: "Open Scouts consent form" });
    await button.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);

    await button.click();
    await expect(page.getByTestId("consent-form-view")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Activities Consent Form" })).toBeVisible();

    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(8);
  });

  test("section selection is keyboard operable without a selection-time jump", async ({ page }) => {
    const button = page.getByRole("button", { name: "Open Beavers consent form" });
    await button.scrollIntoViewIfNeeded();
    await button.focus();
    const before = await page.evaluate(() => window.scrollY);

    await page.keyboard.press("Enter");
    await expect(page.getByTestId("consent-form-view")).toBeVisible();
    await expect(page.getByText("Beavers", { exact: true }).first()).toBeVisible();

    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(8);
  });

  test("changing section returns to the chooser without a large viewport jump", async ({ page }) => {
    const button = page.getByRole("button", { name: "Open Cubs consent form" });
    await button.scrollIntoViewIfNeeded();
    await button.click();
    await expect(page.getByTestId("consent-form-view")).toBeVisible();

    const changeSection = page.getByRole("button", { name: "Change Section" });
    await changeSection.scrollIntoViewIfNeeded();
    const before = await page.evaluate(() => window.scrollY);
    await changeSection.click();

    await expect(page.getByTestId("consent-section-chooser")).toBeVisible();
    const after = await page.evaluate(() => window.scrollY);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(8);
  });
});
