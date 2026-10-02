import { expect, test, type Page } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL || "test.scout.section.leader@example.com";

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(leaderEmail);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("SW-263 focuses and reveals the highest invalid mandatory field without clearing entered values", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page);
  await page.goto("/leader/profile/consent");
  await expect(page.getByRole("heading", { name: "Scouter Medical Advice Form" })).toBeVisible();

  await page.getByLabel("Address").fill("TEST retained address");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("button", { name: "Continue" }).click();

  const first = page.getByLabel("Applicant name");
  await expect(first).toBeFocused();
  await expect(first).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Date of birth")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Address")).toHaveValue("TEST retained address");
  await expect(first).toBeInViewport();
  const unobscured = await first.evaluate((input) => {
    const rect = input.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return hit === input || input.contains(hit);
  });
  expect(unobscured).toBe(true);

  await first.fill("TEST Focus User");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Date of birth")).toBeFocused();
  await expect(page.getByLabel("Applicant name")).toHaveValue("TEST Focus User");
  await expect(page.getByLabel("Address")).toHaveValue("TEST retained address");
});
