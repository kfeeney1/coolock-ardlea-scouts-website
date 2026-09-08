import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const seededJourneyData = process.env.E2E_LEADER_JOURNEY_SEEDED === "true";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Section-aware card identity runs once on desktop Chromium.");
}

function mobileOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile dropdown regression runs once on Pixel 7 Chromium.");
}

async function loginAdmin(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(adminEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function assertSectionDropdownBehaviour(page: Page) {
  const sectionFilter = page.getByRole("combobox", { name: "Section", exact: true });
  await expect(sectionFilter).toContainText("All sections");
  const triggerBox = await sectionFilter.boundingBox();
  expect(triggerBox).not.toBeNull();
  await sectionFilter.click();

  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  const menuBox = await listbox.boundingBox();
  expect(menuBox).not.toBeNull();
  const verticalGap = Math.max(
    triggerBox!.y - (menuBox!.y + menuBox!.height),
    menuBox!.y - (triggerBox!.y + triggerBox!.height),
    0
  );
  expect(verticalGap).toBeLessThanOrEqual(2);
  expect(menuBox!.x).toBeLessThan(triggerBox!.x + triggerBox!.width);
  expect(menuBox!.x + menuBox!.width).toBeGreaterThan(triggerBox!.x);

  const cubsOption = page.getByRole("option", { name: "Cubs", exact: true });
  const scoutsOption = page.getByRole("option", { name: "Scouts", exact: true });
  await expect(cubsOption).toHaveAttribute("data-section", "Cubs");
  await expect(cubsOption.getByTestId("section-swatch-cubs")).toBeVisible();
  await expect(scoutsOption).toHaveAttribute("data-section", "Scouts");
  await expect(scoutsOption.getByTestId("section-swatch-scouts")).toBeVisible();
  const [cubsBackground, scoutsBackground] = await Promise.all([
    cubsOption.evaluate((element) => getComputedStyle(element).backgroundColor),
    scoutsOption.evaluate((element) => getComputedStyle(element).backgroundColor)
  ]);
  expect(cubsBackground).toBe(scoutsBackground);

  await cubsOption.click();
  await expect(listbox).toBeHidden();
  await expect(sectionFilter).toContainText("Cubs");
  await expect(sectionFilter.getByTestId("section-swatch-cubs")).toBeVisible();
}

test("member, child and leader cards keep a textual section identity alongside the section accent", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");
  test.skip(!seededJourneyData, "Run against the canonical deterministic E2E seed.");

  await loginAdmin(page);

  await page.goto("/leader/members");
  const memberCard = page.getByTestId("member-card-TEST_member_beaver_01");
  await expect(memberCard).toBeVisible();
  await expect(memberCard).toHaveAttribute("data-section", "Beavers");
  await expect(memberCard.locator('[data-section-identity="Beavers"]')).toContainText("Beavers");
  await expect(memberCard.getByText("Active", { exact: true })).toBeVisible();

  await page.goto("/leader/badgework");
  const childCard = page.getByTestId("badgework-overview-member-TEST_member_beaver_01");
  await expect(childCard).toBeVisible();
  await expect(childCard).toHaveAttribute("data-section", "Beavers");
  await expect(childCard.getByTestId("section-swatch-beavers")).toBeVisible();
  await expect(childCard).toContainText("Beavers");

  await assertSectionDropdownBehaviour(page);
  await expect(page.getByTestId("badgework-overview-member-TEST_member_beaver_01")).toBeHidden();

  await page.goto("/leader/access");
  const leaderCard = page.getByTestId("leader-access-TEST_uid_multi_section_leader");
  await expect(leaderCard).toBeVisible();
  const leaderSection = await leaderCard.getAttribute("data-section");
  expect(leaderSection).toBeTruthy();
  await expect(leaderCard.getByText(leaderSection!, { exact: true }).first()).toBeVisible();
  await expect(leaderCard.getByText("leader", { exact: true })).toBeVisible();
});

test("section dropdown stays attached and restrained on mobile", async ({ page }, testInfo) => {
  mobileOnly(testInfo);
  test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");
  test.skip(!seededJourneyData, "Run against the canonical deterministic E2E seed.");

  await loginAdmin(page);
  await page.goto("/leader/badgework");
  await expect(page.getByRole("heading", { name: "Adventure Skills Badgework", exact: true })).toBeVisible();
  await assertSectionDropdownBehaviour(page);
});
