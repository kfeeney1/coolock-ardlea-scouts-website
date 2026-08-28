import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const adminEmail = process.env.E2E_ADMIN_EMAIL;
const parentEmail = process.env.E2E_PARENT_EMAIL;
const seededJourneyData = process.env.E2E_LEADER_JOURNEY_SEEDED === "true";

const firstMemberId = "TEST_member_beaver_01";
const secondMemberId = "TEST_member_beaver_02";
const firstMemberName = "Riley Nolan Beavers 01";
const secondMemberName = "Morgan Kavanagh Beavers 02";

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Adventure Skills regression journey runs once on desktop Chromium.");
}

async function loginLeader(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

async function signOutLeader(page: Page) {
  const menuButton = page.getByRole("button", { name: /(Open Leader Menu|Leader Menu|Menu ·)/ });
  await expect(menuButton).toBeVisible();
  await menuButton.click();
  await page.getByRole("button", { name: "Sign Out" }).click();
  await expect(page).toHaveURL(/\/leader\/login$/);
}

async function loginParent(page: Page) {
  await page.goto("/parent");
  await page.getByLabel("Email").fill(parentEmail!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByText(/Your account is approved and linked to 2 member records/i)).toBeVisible();
}

async function selectMember(page: Page, name: string) {
  const memberName = page.getByText(name, { exact: true });
  await expect(memberName).toBeVisible();
  const label = memberName.locator("xpath=ancestor::label");
  await label.getByRole("checkbox").check();
}

test.describe("Adventure Skills badgework", () => {
  test.beforeEach(({}, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");
    test.skip(!seededJourneyData, "Run against the canonical deterministic E2E seed.");
  });

  test("admin can select multiple members and meeting handoff preselects attendees", async ({ page }) => {
    await loginLeader(page, adminEmail!);
    await page.goto("/leader/badgework");
    await expect(page.getByRole("heading", { name: "Adventure Skills Badgework" })).toBeVisible();

    await selectMember(page, firstMemberName);
    await selectMember(page, secondMemberName);
    await expect(page.getByRole("button", { name: "Select 2 members and continue" })).toBeEnabled();
    await page.getByRole("button", { name: "Select 2 members and continue" }).click();
    await expect(page.getByText("2 selected:")).toBeVisible();
    await expect(page.getByText(/Completion source details are shown when one child is selected/i)).toBeVisible();

    await page.goto(`/leader/badgework?sourceType=weeklyMeeting&sourceId=TEST_e2e_weekly_scout&memberIds=${firstMemberId},${secondMemberId}&returnTo=/leader/weekly`);
    await expect(page.getByText(/Recording badgework from Weekly Meeting/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Select 2 members and continue" })).toBeEnabled();
    await expect(page.getByRole("link", { name: "Back to Weekly Meeting" })).toBeVisible();
  });

  test("saved badgework and award are visible read-only to the linked parent", async ({ page }) => {
    test.skip(!parentEmail, "Configure canonical E2E parent credentials.");

    await loginLeader(page, adminEmail!);
    await page.goto("/leader/badgework");
    await selectMember(page, firstMemberName);
    await page.getByRole("button", { name: "Select 1 member and continue" }).click();
    await expect(page.getByRole("heading", { name: "Record badgework" })).toBeVisible();

    // Camping Stage 1 is the canonical default when entering the badgework step.
    await expect(page.getByText("Stage 1 award")).toBeVisible();

    const awardPanel = page.getByTestId("badge-award-panel");
    await expect(awardPanel.getByRole("button", { name: "Award badge" })).toBeDisabled();

    await page.getByRole("button", { name: "Mark full stage complete" }).click();
    await expect(page.getByText(/unsaved badgework changes/i)).toBeVisible();
    await expect(awardPanel.getByRole("button", { name: "Award badge" })).toBeDisabled();

    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText(/badgework .* saved for 1 selected child/i)).toBeVisible();
    await expect(awardPanel.getByText("Requirements complete", { exact: true })).toBeVisible();

    // Playwright retries reuse the same emulator. If an earlier attempt already
    // awarded the badge, preserve that valid persisted state instead of failing.
    const alreadyAwarded = await awardPanel.getByText("Awarded", { exact: true }).isVisible();
    if (!alreadyAwarded) {
      await expect(awardPanel.getByRole("button", { name: "Award badge" })).toBeEnabled();
      await awardPanel.getByRole("button", { name: "Award badge" }).click();
      await expect(page.getByText(/Stage 1 Camping awarded to 1 selected child/i)).toBeVisible();
    }
    await expect(awardPanel.getByText("Awarded", { exact: true })).toBeVisible();

    await signOutLeader(page);
    await loginParent(page);

    await expect(page.getByRole("heading", { name: "Adventure Skills Progress" })).toBeVisible();
    const camping = page.getByTestId("parent-adventure-skill-camping");
    await expect(camping).toContainText("1/9 stages awarded");
    await camping.getByRole("button", { name: /Stage 1/ }).click();
    const campingStageOne = page.locator("#camping-stage-1-content");
    await expect(campingStageOne).toBeVisible();
    await expect(camping.getByText("Requirements complete", { exact: true })).toBeVisible();
    await expect(camping.getByText("Awarded", { exact: true })).toBeVisible();
    await expect(campingStageOne.getByText("Outstanding", { exact: true })).toHaveCount(0);
    await expect(campingStageOne.getByText("Completed", { exact: true }).first()).toBeVisible();

    const hillwalking = page.getByTestId("parent-adventure-skill-hillwalking");
    await hillwalking.getByRole("button", { name: /Stage 1/ }).click();
    const hillwalkingStageOne = page.locator("#hillwalking-stage-1-content");
    const buddyStatement = hillwalkingStageOne.getByText(/Buddy System/i).first();
    await expect(buddyStatement).toBeVisible();
    const buddyRow = buddyStatement.locator("xpath=ancestor::*[contains(@class,'MuiPaper-root')]");
    await expect(buddyRow.getByText("Completed", { exact: true })).toBeVisible();

    await expect(page.getByRole("button", { name: "Award badge" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Save changes" })).toHaveCount(0);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });
});
