import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const seededJourneyData = process.env.E2E_LEADER_JOURNEY_SEEDED === "true";
const unapprovedIdentityEmail = process.env.E2E_PARENT_EMAIL;
const leaderEmail = process.env.E2E_LEADER_EMAIL;
const adminEmail = process.env.E2E_ADMIN_EMAIL;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Leader journey checks run once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
}

async function openLeaderMenu(page: Page) {
  const button = page.getByRole("button", { name: /(Leader Menu|Menu ·)/ });
  await expect(button).toBeVisible();
  await button.click();
}

test.describe("leader journey", () => {
  test("seeded identity without leader approval remains blocked from leader access", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password || !unapprovedIdentityEmail, "Configure canonical E2E credentials.");

    await login(page, unapprovedIdentityEmail!);
    await expect(page.getByRole("heading", { name: "Leader Login" })).toBeVisible();
    await expect(page.getByText(/make sure an administrator has approved your leader account/i)).toBeVisible();
  });

  test("administrator can discover Leader Requests and canonical pending assignment", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password || !adminEmail, "Configure canonical E2E admin credentials.");

    await login(page, adminEmail!);
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
    await openLeaderMenu(page);
    const leaderRequestsMenuLink = page.getByRole("link", { name: "Leader Requests", exact: true });
    await expect(leaderRequestsMenuLink).toBeVisible();

    await leaderRequestsMenuLink.click();
    await expect(page).toHaveURL(/\/leader\/requests$/);
    await expect(page.getByRole("heading", { name: "Leader Requests" })).toBeVisible();

    if (seededJourneyData) {
      await expect(page.getByText("Pending Scouter")).toBeVisible();
      await expect(page.getByText("test_flow_leader_request_pending@example.com")).toBeVisible();
      await expect(page.getByText(/Scouter · Beavers/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Review Request" }).first()).toBeVisible();
    }
  });

  test("approved programme scouter can move through members events and consent", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

    await login(page, leaderEmail!);
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
    await expect(page.getByText(/Scouts Programme Scouter · leader · Scouts/i)).toBeVisible();

    await openLeaderMenu(page);
    await expect(page.getByRole("link", { name: "Leader Requests", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Leader Access", exact: true })).toHaveCount(0);

    await page.getByRole("link", { name: "Member Management", exact: true }).click();
    await expect(page).toHaveURL(/\/leader\/members$/);
    await expect(page.getByRole("heading", { name: "Member Management" })).toBeVisible();
    if (seededJourneyData) {
      await expect(page.getByText("Casey OBrien Scouts 01")).toBeVisible();
      await expect(page.getByText("Taylor Walsh Cubs 01")).toHaveCount(0);
      await expect(page.getByText("Riley Nolan Beavers 01")).toHaveCount(0);
    }

    await openLeaderMenu(page);
    await page.getByRole("link", { name: "Events & Activities", exact: true }).click();
    await expect(page).toHaveURL(/\/leader\/events$/);
    await expect(page.getByRole("heading", { name: "Events & Activities" })).toBeVisible();
    if (seededJourneyData) {
      await expect(page.getByText("TEST Scouts Closed Hike")).toBeVisible();
      await expect(page.getByText("TEST Scout Consent Night")).toBeVisible();
      await expect(page.getByText("TEST Cubs Draft Camp")).toHaveCount(0);
      await expect(page.getByText("TEST Beavers Open Day Trip")).toHaveCount(0);
    }

    await openLeaderMenu(page);
    await page.getByRole("link", { name: "Event Consent", exact: true }).click();
    await expect(page).toHaveURL(/\/leader\/event-consent$/);
    await expect(page.getByRole("heading", { name: "Parent Event Consent" })).toBeVisible();
    if (seededJourneyData) {
      await expect(page.getByText("TEST Scout Consent Night")).toBeVisible();
      await expect(page.getByText("TEST Beavers Open Day Trip")).toHaveCount(0);
    }
  });
});
