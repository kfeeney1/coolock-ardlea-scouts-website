import { expect, test } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

test("leader menu prioritises Weekly Meetings and Events and moves organisation chart into Info", async ({ page }) => {
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(leaderEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

  const menuButton = page.getByRole("button", { name: /Open Leader Menu|Menu ·/ });
  await menuButton.click();
  const menu = page.locator("#leader-navigation");
  await expect(menu.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("href", "/leader");

  const mobile = (page.viewportSize()?.width ?? 0) < 900;
  const groupedNavigation = menu.getByTestId(mobile ? "leader-navigation-mobile" : "leader-navigation-desktop");
  if (mobile) await groupedNavigation.getByRole("button", { name: "Programme" }).click();
  const programmeLinks = groupedNavigation.getByRole("link");
  await expect(programmeLinks.nth(0)).toHaveText("Weekly Meetings");
  await expect(programmeLinks.nth(1)).toHaveText("Events & Activities");
  await expect(menu.getByRole("link", { name: "Weekly Tracker" })).toHaveCount(0);
  await expect(menu.getByRole("link", { name: "Organisational Chart" })).toHaveCount(0);

  const undersizedTargets = await menu.locator("a:visible, button:visible").evaluateAll((controls) => controls
    .map((control) => {
      const rect = control.getBoundingClientRect();
      return { label: (control.textContent || "").trim(), width: rect.width, height: rect.height };
    })
    .filter(({ width, height }) => width < 44 || height < 44));
  expect(undersizedTargets, "Leader navigation controls must retain 44px minimum touch targets.").toEqual([]);

  const infoLink = menu.getByRole("link", { name: "Info & FAQ" });
  await infoLink.focus();
  await expect(infoLink).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(menuButton).toBeFocused();

  await menuButton.click();
  await expect(menu.getByRole("link", { name: "Info & FAQ" })).toBeVisible();
  await menu.getByRole("link", { name: "Info & FAQ" }).click();
  await expect(page).toHaveURL(/\/leader\/info$/);
  await expect(page.getByRole("heading", { name: "Organisational Chart", exact: true })).toBeVisible();
  await expect(page.getByText("Internal organisational hierarchy, sections and reporting relationships for active leaders.")).toBeVisible();
});
