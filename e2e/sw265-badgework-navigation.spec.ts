import { expect, test, type Page, type TestInfo } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = "test.webadmin@example.com";
const blockedReadLimit = 1;

function currentLeaderNavigation(page: Page) {
  return page.locator('[data-testid="leader-navigation-desktop"]:visible, [data-testid="leader-navigation-mobile"]:visible');
}

async function openLeaderMenu(page: Page) {
  const menuButton = page.locator('[data-testid="leader-dashboard-header"] button[aria-controls="leader-navigation"]');
  await expect(menuButton).toBeVisible();
  if ((await menuButton.getAttribute("aria-expanded")) !== "true") await menuButton.click();
  await expect(currentLeaderNavigation(page)).toBeVisible();
}

async function selectProgrammeDestination(page: Page, testInfo: TestInfo, destination: "badgework" | "weekly-meetings") {
  await openLeaderMenu(page);
  const navigation = currentLeaderNavigation(page);
  const programme = navigation.getByRole("button", { name: "Programme", exact: true });
  if (testInfo.project.name === "mobile-chromium" && (await programme.getAttribute("aria-expanded")) !== "true") await programme.click();
  const destinationLink = navigation.getByTestId(`leader-nav-${destination}`);
  await expect(destinationLink).toBeVisible();
  await destinationLink.click();
}

async function login(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(leaderEmail);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard", exact: true })).toBeVisible();
}

test.describe("SW-265 Badgework navigation under slow progress reads", () => {
  test("Badgework can be entered, navigated and exited while overview data is delayed", async ({ page }, testInfo) => {
    test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Run the authenticated navigation check on desktop and mobile Chromium.");
    test.skip(!password, "Configure canonical E2E test-user credentials.");

    let releaseReads!: () => void;
    let blockedReadCount = 0;
    let totalProgressReadCount = 0;
    let readsReleased = false;
    const readBarrier = new Promise<void>((resolve) => { releaseReads = resolve; });
    const progressRead = /"collectionId":"(?:requirements|awards)"/;
    const firestoreQuery = /\/google\.firestore\.v1\.Firestore\/(?:Listen\/channel|RunQuery)/;
    const holdProgressReads = async (route: import("@playwright/test").Route) => {
      const postData = route.request().postData() || "";
      const requestBody = new URLSearchParams(postData);
      let decodedBody = postData;
      try { decodedBody = decodeURIComponent(postData.replaceAll("+", " ")); } catch { /* Keep the raw request body for JSON or malformed payloads. */ }
      const requestText = `${route.request().url()} ${postData} ${decodedBody} ${[...requestBody.values()].join(" ")}`;
      if (progressRead.test(requestText) && requestText.includes("memberAdventureSkillProgress")) {
        totalProgressReadCount += 1;
        if (!readsReleased && blockedReadCount < blockedReadLimit) {
          blockedReadCount += 1;
          await readBarrier;
        }
      }
      await route.continue();
    };

    await page.route(firestoreQuery, holdProgressReads);
    try {
      await login(page);
      await selectProgrammeDestination(page, testInfo, "badgework");
      await expect(page).toHaveURL(/\/leader\/badgework$/);
      await expect(page.getByRole("heading", { name: "Adventure Skills Badgework", exact: true })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Badgework Overview", exact: true })).toBeVisible();
      await expect(page.getByText("Loading Badgework Overview…", { exact: true })).toBeVisible();
      await expect.poll(() => blockedReadCount, { message: "Badgework overview starts its bounded progress reads" }).toBeGreaterThanOrEqual(blockedReadLimit);

      // Keep these reads unresolved while leaving Badgework. The destination
      // must become usable without releasing or timing out the slow requests.
      await selectProgrammeDestination(page, testInfo, "weekly-meetings");
      await expect(page).toHaveURL(/\/leader\/weekly$/);
      await expect(page.getByRole("heading", { name: "Weekly Meetings", exact: true })).toBeVisible();
      await expect(page.getByTestId("leader-dashboard-header")).toBeVisible();
      expect(blockedReadCount).toBe(blockedReadLimit);

      readsReleased = true;
      releaseReads();
      await selectProgrammeDestination(page, testInfo, "badgework");
      await expect(page).toHaveURL(/\/leader\/badgework$/);
      await expect(page.getByRole("heading", { name: "Badgework Overview", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /Awaiting award · \d+/ })).toBeVisible();

      // Record mode reuses the authoritative overview data instead of issuing
      // the same pair of progress reads again for the selected child.
      const overviewReadCount = totalProgressReadCount;
      await page.getByRole("button", { name: "Record badgework", exact: true }).click();
      const member = page.getByRole("checkbox", { name: /Riley Nolan Beavers 01/ }).first();
      await expect(member).toBeVisible();
      await member.check();
      await page.getByRole("button", { name: "Select 1 member and continue", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Record badgework", exact: true })).toBeVisible();
      expect(totalProgressReadCount).toBe(overviewReadCount);

      await page.getByRole("button", { name: "Badgework Overview", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Badgework Overview", exact: true })).toBeVisible();
      await selectProgrammeDestination(page, testInfo, "weekly-meetings");
      await expect(page).toHaveURL(/\/leader\/weekly$/);
      await expect(page.getByRole("heading", { name: "Weekly Meetings", exact: true })).toBeVisible();
    } finally {
      readsReleased = true;
      releaseReads();
      await page.unroute(firestoreQuery, holdProgressReads);
    }
  });
});
