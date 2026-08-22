import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const seededJourneyData = process.env.E2E_LEADER_JOURNEY_SEEDED === "true";
const pendingLeaderEmail = "test.leader.pending@example.com";
const leaderEmail = "test.leader.only@example.com";
const adminEmail = "test.admin@example.com";

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
  test("pending leader remains blocked until administrator approval", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

    await login(page, pendingLeaderEmail);
    await expect(page.getByRole("heading", { name: "Leader Login" })).toBeVisible();
    await expect(page.getByText(/make sure an administrator has approved your leader account/i)).toBeVisible();
  });

  test("administrator can discover Leader Requests and seeded pending assignment", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

    await login(page, adminEmail);
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
    await openLeaderMenu(page);
    await expect(page.getByRole("link", { name: "Leader Requests" })).toBeVisible();

    await page.getByRole("link", { name: "Leader Requests" }).click();
    await expect(page).toHaveURL(/\/leader\/requests$/);
    await expect(page.getByRole("heading", { name: "Leader Requests" })).toBeVisible();

    if (seededJourneyData) {
      await expect(page.getByText("Patrick Doyle")).toBeVisible();
      await expect(page.getByText("test.leader.pending@example.com")).toBeVisible();
      await expect(page.getByText(/Section Leader · Cubs/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Review Request" })).toBeVisible();
    }
  });

  test("approved section leader can move through members events and consent", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

    await login(page, leaderEmail);
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
    await expect(page.getByText(/Aisling Ryan · leader · Scouts/i)).toBeVisible();

    await openLeaderMenu(page);
    await expect(page.getByRole("link", { name: "Leader Requests" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Leader Access" })).toHaveCount(0);

    await page.getByRole("link", { name: "Member Management" }).click();
    await expect(page).toHaveURL(/\/leader\/members$/);
    await expect(page.getByRole("heading", { name: "Member Management" })).toBeVisible();
    if (seededJourneyData) {
      await expect(page.getByText("Sophie Ryan")).toBeVisible();
      await expect(page.getByText("Emma Byrne")).toHaveCount(0);
      await expect(page.getByText("Aoife Murphy")).toHaveCount(0);
    }

    await openLeaderMenu(page);
    await page.getByRole("link", { name: "Events & Activities" }).click();
    await expect(page).toHaveURL(/\/leader\/events$/);
    await expect(page.getByRole("heading", { name: "Events & Activities" })).toBeVisible();
    if (seededJourneyData) {
      await expect(page.getByText("TEST Scout Hike")).toBeVisible();
      await expect(page.getByText("TEST Cub Weekend Camp")).toHaveCount(0);
      await expect(page.getByText("TEST Beaver Zoo Trip")).toHaveCount(0);
    }

    await openLeaderMenu(page);
    await page.getByRole("link", { name: "Event Consent" }).click();
    await expect(page).toHaveURL(/\/leader\/event-consent$/);
    await expect(page.getByRole("heading", { name: "Parent Event Consent" })).toBeVisible();
    if (seededJourneyData) {
      await expect(page.getByText("TEST Scout Hike")).toBeVisible();
      await expect(page.getByText("TEST Cub Weekend Camp")).toHaveCount(0);
    }
  });
});
