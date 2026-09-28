import { expect, test } from "@playwright/test";

test("password visibility is masked by default and toggles without changing the value", async ({ page }) => {
  await page.goto("/leader/login");
  const password = page.getByLabel("Password");
  await password.fill("visible-test-value");
  await expect(password).toHaveAttribute("type", "password");

  const reveal = page.getByRole("button", { name: "Show characters" });
  await expect(reveal).toHaveAttribute("aria-pressed", "false");
  await reveal.focus();
  await page.keyboard.press("Enter");
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("visible-test-value");

  const hide = page.getByRole("button", { name: "Hide characters" });
  await expect(hide).toHaveAttribute("aria-pressed", "true");
  await hide.click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveValue("visible-test-value");
});

test("password creation and confirmation fields use the same accessible control", async ({ page }) => {
  await page.goto("/leader/register");
  for (const label of ["Password", "Confirm password"]) {
    const field = page.getByLabel(label);
    await field.fill(`${label}-value`);
    await expect(field).toHaveAttribute("type", "password");
    await field.locator("..").getByRole("button", { name: "Show characters" }).click();
    await expect(field).toHaveAttribute("type", "text");
    await expect(field).toHaveValue(`${label}-value`);
  }
});
