import { expect, test, type Browser, type Page } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
const superEmail = process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com";
const accounts = [
  { email: "test.group.quartermaster@example.com", group: "Quartermaster / Bo’sun", id: "qm-reports", route: "/leader/qm-reports", identity: "qm-reports", hidden: "Secretary", permitted: ["qm-settings", "qm-reports"], forbidden: ["activity-log", "leader-access", "join-management", "treasurer-subs"] },
  { email: "test.group.secretary@example.com", group: "Secretary", id: "secretary-meeting-records", route: "/leader/meetings?view=secretary", identity: "secretary-meeting-records", hidden: "Quartermaster / Bo’sun", permitted: ["activity-log", "secretary-meeting-records"], forbidden: ["leader-access", "join-management", "qm-reports", "treasurer-subs"] },
  { email: process.env.E2E_LEADER_EMAIL || "test.scout.programme.scouter@example.com", group: "Programme", id: "weekly-meetings", route: "/leader/weekly", identity: "weekly-meetings", hidden: "Treasurer", permitted: ["events-activities", "programme-equipment"], forbidden: ["activity-log", "leader-access", "join-management", "qm-reports"] },
  { email: "test.group.leader@example.com", group: "People & Parents", id: "member-management", route: "/leader/members", identity: "member-management", hidden: "Treasurer", permitted: ["leader-access", "join-management", "activity-log"], forbidden: ["qm-reports", "treasurer-subs", "parent-access"] },
  { email: "test.group.chairperson@example.com", group: "Group Operations", id: "group-meeting-records", route: "/leader/meetings?view=group-operations", identity: "group-meeting-records", hidden: "Treasurer", permitted: ["secretary-meeting-records", "group-meeting-records"], forbidden: ["activity-log", "leader-access", "join-management", "qm-reports"] }
];
async function selectVersion(page: Page, version: "Existing" | "Redesigned") {
  await page.goto("/leader/settings");
  const button = page.getByRole("button", { name: `${version} navigation`, exact: true });
  await expect(button).toBeEnabled();
  if (await button.getAttribute("aria-pressed") !== "true") await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}
async function openMenu(page: Page) {
  const toggle = page.getByRole("button", { name: /Leader Menu|Menu ·/ });
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await expect(page.getByRole("navigation", { name: "Leader navigation" })).toBeVisible();
}
function navigationRoot(page: Page, redesigned: boolean, mobile: boolean) {
  return page.getByTestId(redesigned ? "leader-navigation-redesigned" : mobile ? "leader-navigation-mobile" : "leader-navigation-desktop");
}
async function expose(page: Page, category: string, redesigned: boolean, mobile: boolean) {
  await openMenu(page);
  const root = navigationRoot(page, redesigned, mobile);
  if (redesigned || mobile) {
    const toggle = root.getByRole("button", { name: category, exact: !redesigned });
    if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  }
  return root;
}
async function destinations(page: Page, redesigned: boolean, mobile: boolean, minimumCount = 30) {
  await openMenu(page);
  const root = navigationRoot(page, redesigned, mobile);
  const result: string[] = [];
  if (redesigned || mobile) {
    for (const category of await root.getByRole("button").all()) {
      if (await category.getAttribute("aria-expanded") !== "true") await category.click();
      const region = root.getByRole("region");
      await expect(region).toHaveCount(1);
      result.push(...await region.getByRole("link").evaluateAll((links) => links.map((link) => `${link.getAttribute("data-testid")}:${link.getAttribute("href")}`)));
    }
  } else {
    result.push(...await root.getByRole("link").evaluateAll((links) => links.map((link) => `${link.getAttribute("data-testid")}:${link.getAttribute("href")}`)));
  }
  expect(new Set(result).size).toBe(result.length);
  expect(result.length).toBeGreaterThan(minimumCount);
  await page.keyboard.press("Escape");
  return result.sort();
}
async function accountJourney(browser: Browser, baseURL: string, account: typeof accounts[number], redesigned: boolean, mobile: boolean) {
  const context = await browser.newContext({ baseURL, viewport: mobile ? { width: 393, height: 851 } : { width: 1280, height: 900 }, isMobile: mobile, hasTouch: mobile });
  try {
    const page = await context.newPage();
    await loginAsLeader(page, { email: account.email, password: password! });
    const allDestinations = await destinations(page, redesigned, mobile, 0);
    const destinationIds = allDestinations.map((entry) => entry.split(":")[0].replace("leader-nav-", ""));
    for (const id of account.permitted) expect(destinationIds, `${account.email} must see ${id}`).toContain(id);
    for (const id of [...account.forbidden, "system-information", "leader-requests"]) expect(destinationIds, `${account.email} must not see ${id}`).not.toContain(id);
    const navigation = await expose(page, account.group, redesigned, mobile);
    await expect(navigation.getByText(account.hidden, { exact: true })).toHaveCount(0);
    await expect(navigation.getByTestId("leader-nav-system-information")).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const destination = navigation.getByTestId(`leader-nav-${account.id}`);
    await expect(destination).toBeVisible();
    expect((await destination.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await destination.click();
    await expect(page).toHaveURL(new RegExp(account.route.replace(/[?]/g, "\\?") + "$"));
    await expect(page.getByTestId(`page-${account.identity}`)).toBeVisible();
    await page.reload();
    await expect(page.getByTestId(`page-${account.identity}`)).toBeVisible();
    await openMenu(page);
    await expect(navigationRoot(page, redesigned, mobile).getByTestId(`leader-nav-${account.id}`)).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(page.getByRole("navigation", { name: "Leader navigation" })).toBeHidden();
    await expect(page.getByTestId(`page-${account.identity}`)).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/leader$/);
    await page.goto("/leader/system");
    await expect(page).toHaveURL(/\/leader$/);
    await expect(page.getByTestId("page-system-information")).toHaveCount(0);
    await page.goto("/leader/settings");
    await expect(page.getByRole("button", { name: "Redesigned navigation", exact: true })).toHaveCount(0);
  } finally { await context.close(); }
}

test("Superuser persists both versions with complete menu parity, keyboard state and return links", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  const mobile = testInfo.project.name === "mobile-chromium";
  await loginAsLeader(page, { email: superEmail, password: password! });
  await page.goto("/leader/settings");
  await expect(page.getByRole("button", { name: "Existing navigation", exact: true })).toHaveAttribute("aria-pressed", "true");
  let baseline: string[] = [];
  try {
    for (const redesigned of [false, true]) {
      const mode = redesigned ? "Redesigned" : "Existing";
      await selectVersion(page, mode);
      await page.reload();
      await expect(page.getByRole("button", { name: `${mode} navigation`, exact: true })).toHaveAttribute("aria-pressed", "true");
      const actual = await destinations(page, redesigned, mobile);
      if (!redesigned) baseline = actual;
      else expect(actual).toEqual(baseline);
      await page.goto("/leader/qm-reports");
      await expect(page.getByTestId("page-qm-reports")).toBeVisible();
      const root = await expose(page, "Quartermaster / Bo’sun", redesigned, mobile);
      await expect(root.getByTestId("leader-nav-qm-reports")).toHaveAttribute("aria-current", "page");
      if (redesigned) {
        await page.screenshot({ path: testInfo.outputPath("redesigned-navigation.png"), fullPage: true });
        const toggle = root.getByRole("button", { name: /Programme/ });
        const history = await page.evaluate(() => window.history.length);
        await toggle.focus(); await page.keyboard.press("Enter");
        await expect(toggle).toHaveAttribute("aria-expanded", "true");
        await expect(root.getByRole("region", { name: /Quartermaster/ })).toHaveCount(0);
        expect(await page.evaluate(() => window.history.length)).toBe(history);
      }
      await page.keyboard.press("Escape");
      await expect(page.getByRole("navigation", { name: "Leader navigation" })).toBeHidden();
      await page.getByRole("link", { name: "Back to Equipment & Stores", exact: true }).click();
      await expect(page).toHaveURL(/\/leader\/equipment\?view=quartermaster$/);
      await expect(page.getByTestId("page-qm-equipment-stores")).toBeVisible();
    }
  } finally { await selectVersion(page, "Existing"); }
});

for (const redesigned of [false, true]) {
  test(`${redesigned ? "Redesigned" : "Existing"} navigation preserves role boundaries, fresh sessions, reload and Back`, async ({ page, browser }, testInfo) => {
    test.setTimeout(240_000);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
    const mobile = testInfo.project.name === "mobile-chromium";
    await loginAsLeader(page, { email: superEmail, password: password! });
    try {
      await selectVersion(page, redesigned ? "Redesigned" : "Existing");
      for (const account of accounts) {
        await test.step(account.group, () => accountJourney(browser, process.env.E2E_BASE_URL || "http://127.0.0.1:4173", account, redesigned, mobile));
      }
    } finally { await selectVersion(page, "Existing"); }
  });
}
