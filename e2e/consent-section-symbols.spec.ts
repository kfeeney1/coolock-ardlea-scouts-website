import { expect, test } from "@playwright/test";

const youthSections = [
  { value: "Beavers", label: "Beavers" },
  { value: "Cubs", label: "Cubs" },
  { value: "Scouts", label: "Scouts" },
  { value: "Ventures", label: "Ventures" },
  { value: "Rovers", label: "Rover Scouts" }
] as const;

test.describe("public consent section chooser", () => {
  test("uses the supplied ONE Programme symbols without replacing accessible labels", async ({ page }) => {
    await page.goto("/activities/consent");

    for (const section of youthSections) {
      const button = page.getByRole("button", { name: `Open ${section.label} consent form` });
      await expect(button).toBeVisible();
      await expect(page.getByTestId(`official-section-symbol-${section.value.toLowerCase()}`)).toBeVisible();
    }

    await expect(page.getByRole("button", { name: /Open Scouter.*consent form/i })).toBeVisible();
  });

  test("section choices remain keyboard operable on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/activities/consent");

    const beavers = page.getByRole("button", { name: "Open Beavers consent form" });
    await beavers.focus();
    await expect(beavers).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: /Beaver/i })).toBeVisible();
  });
});
