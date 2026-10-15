import { expect, type Page, type TestInfo } from "@playwright/test";
import { loginAsLeader, type LeaderCredentials } from "./authentication-helpers";

export type Credentials = LeaderCredentials;

export function credentials(prefix: string): Credentials {
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`] || process.env.E2E_TEST_USER_PASSWORD;
  if (!email || !password) throw new Error(`Missing required ${prefix} navigation-test credentials`);
  return { email, password };
}

export const login = loginAsLeader;

export async function openMenu(page: Page, testInfo: TestInfo) {
  const header = page.getByTestId("leader-dashboard-header");
  const button = header.locator('button[aria-controls="leader-navigation"]');
  const navigation = projectNavigation(page, testInfo);
  await expect(button).toBeVisible();
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(navigation).toBeVisible();
}

export async function exposeGroup(page: Page, testInfo: TestInfo, group: string) {
  await openMenu(page, testInfo);
  const navigation = projectNavigation(page, testInfo);
  const button = navigation.getByRole("button", { name: group, exact: true });
  if (testInfo.project.name === "mobile-chromium" && (await button.getAttribute("aria-expanded")) !== "true") {
    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
  }
  return navigation;
}

export async function clickNavItem(page: Page, testInfo: TestInfo, group: string, itemId: string) {
  const navigation = await exposeGroup(page, testInfo, group);
  const item = navigation.getByTestId(`leader-nav-${itemId}`);
  await expect(item).toBeVisible();
  await expect(item).toBeEnabled();
  await item.click();
}

export async function assertSiblingNotCurrent(page: Page, testInfo: TestInfo, group: string, itemId: string) {
  const navigation = await exposeGroup(page, testInfo, group);
  await expect(navigation.getByTestId("leader-nav-" + itemId)).not.toHaveAttribute("aria-current", "page");
}

export function projectNavigation(page: Page, _testInfo: TestInfo) {
  // Responsive rendering is authoritative: route changes can briefly remount the
  // navigation surface, so select the currently visible container instead of
  // assuming the Playwright project name always matches the mounted DOM variant.
  return page.locator(
    '[data-testid="leader-navigation-desktop"]:visible, [data-testid="leader-navigation-mobile"]:visible'
  );
}

export async function exposeQuartermaster(page: Page, testInfo: TestInfo) {
  await openMenu(page, testInfo);
  const navigation = projectNavigation(page, testInfo);
  await expect(navigation).toBeVisible();
  const quartermaster = navigation.getByRole("button", { name: "Quartermaster / Bo’sun" });
  if ((await quartermaster.count()) > 0 && (await quartermaster.getAttribute("aria-expanded")) !== "true") {
    await quartermaster.click();
    await expect(quartermaster).toHaveAttribute("aria-expanded", "true");
  }
  return navigation;
}

