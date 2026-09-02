import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Credentials = { email: string; password: string };

const linkedParentMember = "Riley Nolan Beavers 01";
const unlinkedParentMember = "Dylan Dunne Beavers 03";
const inSectionLeaderMemberId = "TEST_member_scout_01";
const inSectionLeaderMember = "Casey OBrien Scouts 01";
const outOfSectionLeaderMemberId = "TEST_member_beaver_01";
const outOfSectionLeaderMember = linkedParentMember;

function credentials(prefix: string): Credentials | null {
  const email = process.env[`${prefix}_EMAIL`]?.trim();
  const password = process.env[`${prefix}_PASSWORD`] || process.env.E2E_TEST_USER_PASSWORD;
  return email && password ? { email, password } : null;
}

function chromiumOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Release authorization boundary checks run once on desktop Chromium.");
}

async function loginLeader(page: Page, account: Credentials) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function loginParent(page: Page, account: Credentials) {
  await page.goto("/parent");
  await page.getByLabel("Email").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText("Parent Consent Portal").first()).toBeVisible();
}

test.describe("release authorization boundaries", () => {
  const leader = credentials("E2E_LEADER");
  const parent = credentials("E2E_PARENT");

  test("ordinary leader can open an assigned-section member but not another section member", async ({ page }, testInfo) => {
    chromiumOnly(testInfo);
    test.skip(!leader, "Configure canonical E2E leader credentials.");
    await loginLeader(page, leader!);

    await page.goto(`/leader/members/${inSectionLeaderMemberId}`);
    await expect(page.getByRole("heading", { name: inSectionLeaderMember, exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Member Details" })).toBeVisible();

    await page.goto(`/leader/members/${outOfSectionLeaderMemberId}`);
    await expect(page.getByText("This member record is unavailable or outside your assigned sections.")).toBeVisible();
    await expect(page.getByRole("heading", { name: outOfSectionLeaderMember, exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Member Details" })).toHaveCount(0);
  });

  test("parent portal exposes linked members but not an unlinked member from the same section", async ({ page }, testInfo) => {
    chromiumOnly(testInfo);
    test.skip(!parent, "Configure canonical E2E parent credentials.");
    await loginParent(page, parent!);

    await expect(page.getByText(linkedParentMember, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(unlinkedParentMember, { exact: true })).toHaveCount(0);

    const search = page.getByTestId("parent-consent-search");
    await search.fill(unlinkedParentMember);
    await expect(page.getByText(unlinkedParentMember, { exact: true })).toHaveCount(0);
    await expect(page.getByText("No linked children match that search.")).toBeVisible();
  });
});
