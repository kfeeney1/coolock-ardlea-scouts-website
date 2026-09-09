import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Organisation role checks run once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("legacy Who's Who URL redirects to About", async ({ page }) => {
  await page.goto("/whos-who");
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { name: "About Us" })).toBeVisible();
});

test("public Who's Who uses accessible collapsed Group and section disclosures without weakening public visibility rules", async ({ page }) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { name: "About Us" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Meet the Leaders" })).toBeVisible();
  await expect(page.getByText("These leaders have chosen to be listed publicly.", { exact: true })).toBeVisible();
  await expect(page.getByTestId("public-whos-who")).toBeVisible();
  await expect(page.getByText("Unable to load Who’s Who right now.")).toHaveCount(0);

  const groupToggle = page.getByRole("button", { name: "Group Leadership", exact: true });
  const beaversToggle = page.getByRole("button", { name: "Beavers", exact: true });
  const scoutsToggle = page.getByRole("button", { name: "Scouts", exact: true });

  for (const toggle of [groupToggle, beaversToggle, scoutsToggle]) {
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  }

  await expect(page.getByTestId("whos-who-leader-group-TEST_uid_group_leader")).toHaveCount(0);
  await expect(page.getByTestId("whos-who-leader-beavers-TEST_uid_beaver_section_leader")).toHaveCount(0);
  await expect(page.getByTestId("whos-who-leader-scouts-TEST_uid_scout_programme_scouter")).toHaveCount(0);

  await groupToggle.focus();
  await expect(groupToggle).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(groupToggle).toHaveAttribute("aria-expanded", "true");

  const groupLeader = page.getByTestId("whos-who-leader-group-TEST_uid_group_leader");
  await expect(groupLeader).toBeVisible();
  await expect(groupLeader).toHaveAttribute("data-section", "Group");
  await expect(groupLeader.getByRole("heading", { name: "Declan O'Connor", exact: true })).toBeVisible();
  await expect(groupLeader.getByText("Group Leader", { exact: true })).toBeVisible();
  await expect(groupLeader.getByText("Group", { exact: true })).toBeVisible();

  await page.keyboard.press("Space");
  await expect(groupToggle).toHaveAttribute("aria-expanded", "false");
  await expect(groupLeader).toHaveCount(0);
  await groupToggle.click();
  await expect(groupToggle).toHaveAttribute("aria-expanded", "true");
  await groupToggle.click();
  await expect(groupToggle).toHaveAttribute("aria-expanded", "false");
  await groupToggle.click();
  await expect(groupToggle).toHaveAttribute("aria-expanded", "true");

  await beaversToggle.click();
  await expect(beaversToggle).toHaveAttribute("aria-expanded", "true");
  const beaverLeader = page.getByTestId("whos-who-leader-beavers-TEST_uid_beaver_section_leader");
  await expect(beaverLeader).toBeVisible();
  await expect(beaverLeader).toHaveAttribute("data-section", "Beavers");
  await expect(beaverLeader.getByRole("heading", { name: "Beavers Section Leader", exact: true })).toBeVisible();
  await expect(beaverLeader.getByText("Section Leader", { exact: true })).toBeVisible();
  await expect(beaverLeader.getByTestId("section-swatch-beavers")).toBeVisible();
  await expect(beaverLeader.getByText("Beavers", { exact: true })).toBeVisible();
  await beaversToggle.click();
  await expect(beaversToggle).toHaveAttribute("aria-expanded", "false");
  await expect(beaverLeader).toHaveCount(0);

  await scoutsToggle.click();
  await expect(scoutsToggle).toHaveAttribute("aria-expanded", "true");
  const scoutsLeader = page.getByTestId("whos-who-leader-scouts-TEST_uid_scout_programme_scouter");
  await expect(scoutsLeader).toBeVisible();
  await expect(scoutsLeader).toHaveAttribute("data-section", "Scouts");
  await expect(scoutsLeader.getByRole("heading", { name: "Scouts Programme Scouter", exact: true })).toBeVisible();
  await expect(scoutsLeader.getByText("Programme Scouter", { exact: true })).toBeVisible();

  for (const forbiddenName of ["Test Website Administrator", "Test Website Super Admin", "Test Multi Section Leader"]) {
    await expect(page.getByRole("heading", { name: forbiddenName, exact: true })).toHaveCount(0);
  }
  await expect(page.getByText("Group Council Administrator", { exact: true })).toHaveCount(0);

  await page.goto("/");
  await page.goto("/about");
  await expect(page.getByRole("button", { name: "Group Leadership", exact: true })).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "Beavers", exact: true })).toHaveAttribute("aria-expanded", "false");
});

test("public Who's Who tiles remain readable without horizontal overflow from phone to desktop", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  await page.goto("/about");
  const beaversToggle = page.getByRole("button", { name: "Beavers", exact: true });
  const leaderTile = page.getByTestId("whos-who-leader-beavers-TEST_uid_beaver_section_leader");

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 820, height: 1000 },
    { width: 1280, height: 900 }
  ]) {
    await page.setViewportSize(viewport);
    if (await beaversToggle.getAttribute("aria-expanded") === "false") await beaversToggle.click();
    await expect(leaderTile).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const box = await leaderTile.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(viewport.width);
  }
});

test("organisation chart rejects unauthenticated leader access", async ({ page }) => {
  await page.goto("/leader/organisation");
  await expect(page).toHaveURL(/\/leader\/login$/);
});

test("programme scouter can open the internal organisation chart with canonical leader data", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");
  await login(page, leaderEmail!);
  await page.goto("/leader/organisation");
  await expect(page.getByRole("heading", { name: "Organisational Chart" })).toBeVisible();
  await expect(page.getByText("Unable to load the internal organisation chart.")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Test Website Administrator", exact: true })).toBeVisible();
  await expect(page.getByText("Group Council Administrator", { exact: true }).first()).toBeVisible();
});

test("administrator sees organisation controls in Leader Access", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await login(page, "test.webadmin@example.com");
  await page.goto("/leader/access");
  await expect(page.getByRole("heading", { name: "Leader Access & Organisation" })).toBeVisible();
  await expect(page.getByText("Organisational chart").first()).toBeVisible();
  await expect(page.getByText("Show on public Who's Who").first()).toBeVisible();
});
