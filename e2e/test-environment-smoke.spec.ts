import { expect, test } from "@playwright/test";
import { acquireParentConsentSettingLock, setParentConsentEnabled } from "./helpers/parent-consent-setting";

const testPassword = process.env.E2E_TEST_USER_PASSWORD;
const stableTestSmoke = process.env.E2E_STABLE_ENVIRONMENT_SMOKE === "true";
const testSmokeContract = process.env.E2E_DEPLOYMENT_SMOKE_CONTRACT === "true";
const runTestSmoke = stableTestSmoke || testSmokeContract;

async function signIn(page: import("@playwright/test").Page, path: string, email: string) {
  await page.goto(path);
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(testPassword!);
  await page.getByRole("button", { name: /^sign in$/i }).click();
}

test.describe("stable TEST environment smoke", () => {
  test.skip(!runTestSmoke, "TEST smoke runs after deployment or as a local PR contract check.");
  test.skip(!testPassword, "Stable TEST smoke requires the synthetic TEST password.");

  if (stableTestSmoke) {
    test("public journey shows a compact TEST banner and About build information", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: "About Us" })).toBeVisible();

    const banner = page.getByTestId("test-environment-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(/TEST · synthetic data · Build [a-f0-9]{7}/i);

    const box = await banner.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.width).toBeLessThanOrEqual(viewport!.width);
    expect(box!.height).toBeLessThanOrEqual(48);

    await expect(page.getByRole("heading", { name: "Build information" })).toBeVisible();
    await expect(page.getByText(/Build .* · Commit [a-f0-9]{7}/i)).toBeVisible();
    await expect(page.getByRole("contentinfo")).not.toContainText(/Build /i);
    });

    test("TEST banner does not obstruct public navigation", async ({ page }) => {
    await page.goto("/");
    const banner = page.getByTestId("test-environment-banner");
    const header = page.locator("header");
    await expect(banner).toBeVisible();
    await expect(header).toBeVisible();

    const bannerBox = await banner.boundingBox();
    const headerBox = await header.boundingBox();
    expect(bannerBox).not.toBeNull();
    expect(headerBox).not.toBeNull();
    expect(bannerBox!.y + bannerBox!.height).toBeLessThanOrEqual(headerBox!.y + 1);
    });
  }

  test("leader journey authenticates a synthetic section leader read-only", async ({ page }) => {
    await signIn(page, "/leader/login", "test.scout.section.leader@example.com");
    await expect(page).toHaveURL(/\/leader(?:\/)?$/);
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  });

  test("parent journey loads event consent requests for linked synthetic children", async ({ page, browser }) => {
    const settingLock = testSmokeContract ? await acquireParentConsentSettingLock() : null;
    let previousConsentEnabled: boolean | null = null;
    try {
      // PR smoke must exercise the enabled consent journey even when another test
      // has left the shared emulator setting disabled. TEST deployment seeding
      // enables the same prerequisite before the live consent smoke runs.
      if (testSmokeContract) previousConsentEnabled = await setParentConsentEnabled(browser, true);

      await signIn(page, "/parent", "test.cub.parent1@example.com");
      await expect(page.getByRole("heading", { name: "Parent Portal" })).toBeVisible();
      await expect(page.getByText(/Your account is approved and linked to/i)).toBeVisible();

      const eventSection = page.locator("#parent-event-consent");
      await expect(eventSection.getByRole("heading", { name: "Upcoming Events & Event Consent" })).toBeVisible();
      const expectedRequest = eventSection.getByTestId("parent-event-consent-tile-TEST_CUB_PARENT_CONSENT_SMOKE");
      await expect.poll(async () => {
        if (await expectedRequest.count()) return "request";
        const error = eventSection.getByTestId("parent-event-consent-error");
        if (await error.count()) return `error: ${await error.innerText()}`;
        const permission = eventSection.getByTestId("parent-event-consent-permission");
        if (await permission.count()) return `permission denied: ${await permission.innerText()}`;
        if (await eventSection.getByText("No upcoming consent requests", { exact: true }).count()) return "empty state";
        return "still loading the consent query";
      }, {
        timeout: 20000,
        message: "The eligible parent must receive the seeded Cubs consent request; the smoke gate reports query errors, permission failures, empty results, or a loading timeout."
      }).toBe("request");
      await expect(eventSection.getByTestId("parent-event-consent-error")).toHaveCount(0);
      await expect(eventSection.getByTestId("parent-event-consent-permission")).toHaveCount(0);
      await expect(eventSection.getByText("No upcoming consent requests", { exact: true })).toHaveCount(0);
      await expect(expectedRequest).toContainText("TEST Cubs Parent Consent Smoke");
      await expect(eventSection.getByText("Showing 1 of 1 upcoming consent request.", { exact: true })).toBeVisible();
      await expect(expectedRequest.getByRole("link", { name: "Complete Event Consent" })).toBeVisible();
    } finally {
      try {
        if (previousConsentEnabled !== null) {
          await setParentConsentEnabled(browser, previousConsentEnabled);
        }
      } finally {
        await settingLock?.();
      }
    }
  });

  test("Superuser reads the deployed Attendance Insights rollout and matching presentation", async ({ page, baseURL }) => {
    const host = new URL(baseURL!).hostname;
    expect(stableTestSmoke
      ? ["coolock-ardlea-scouts-test.web.app", "coolock-ardlea-scouts-test.firebaseapp.com"].includes(host)
      : host === "127.0.0.1" || host === "localhost").toBe(true);
    if (stableTestSmoke) {
      await page.goto("/about");
      const banner = page.getByTestId("test-environment-banner");
      await expect(banner).toContainText("TEST · synthetic data");
      if (process.env.GITHUB_SHA) await expect(banner).toContainText(process.env.GITHUB_SHA.slice(0, 7));
    }
    await signIn(page, "/leader/login", process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com");
    await expect(page.getByRole("heading", { name: "Leader Dashboard", exact: true })).toBeVisible();
    await page.goto("/leader/settings");
    const matrixChoice = page.getByRole("button", { name: "Attendance matrix", exact: true });
    await expect(matrixChoice).toBeEnabled();
    const matrixEnabled = await matrixChoice.getAttribute("aria-pressed") === "true";
    for (let visit = 0; visit < 2; visit++) {
      if (visit === 0) await page.goto("/leader/attendance"); else await page.reload();
      await expect(page.getByRole("heading", { name: "Attendance History & Insights", exact: true })).toBeVisible();
      await expect(page.getByTestId("meeting-average-rate")).toBeVisible();
      await expect(page.getByTestId("event-average-rate")).toBeVisible();
      await expect(page.getByTestId("combined-average-rate")).toBeVisible();
      await expect(page.getByTestId("attendance-member-card").first()).toBeVisible();
      await expect(page.getByRole("alert").filter({ hasText: /Unable to load attendance|permission denied/i })).toHaveCount(0);
      const matrix = page.getByRole("table", { name: "Member attendance by meeting", exact: true });
      if (matrixEnabled) await expect(matrix).toBeVisible(); else await expect(matrix).toHaveCount(0);
    }
    console.log(`TEST attendance presentation verified read-only: ${matrixEnabled ? "matrix" : "existing"}`);
  });

});
