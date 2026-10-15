import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { exposeQuartermaster } from "./support/navigation-recovery-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
const leaderEmail = process.env.E2E_LEADER_EMAIL;

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Site settings checks run once on desktop Chromium.");
}

async function login(page: Page, email: string) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  const leaderNavigation = page.waitForURL((url) => url.pathname === "/leader");
  await page.getByRole("button", { name: "Sign In" }).click();
  await leaderNavigation;
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

test("admin can open and save site inactivity settings", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await login(page, "test.webadmin@example.com");
  await page.goto("/leader/settings");

  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByLabel("Parent account inactivity timeout")).toHaveValue("20");
  await expect(page.getByLabel("Leader desktop inactivity timeout")).toHaveValue("20");
  await expect(page.getByLabel("Leader phone inactivity timeout")).toHaveValue("90");
  await expect(page.getByRole("switch", { name: "Enable Parent Login" })).toHaveCount(0);

  await page.getByRole("button", { name: "Save Settings" }).click();
  await expect(page.getByText(/Site settings saved/)).toBeVisible();
});

test("Treasurer settings keep finance controls and hide session inactivity settings", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Treasurer settings presentation runs on desktop and mobile Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await login(page, "test.group.treasurer@example.com");
  await page.goto("/leader/settings?view=treasurer");

  await expect(page.getByRole("heading", { name: "Treasurer Settings", exact: true })).toBeVisible();
  await expect(page.getByTestId("subs-settings-panel")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Subs rates & classification" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Session inactivity" })).toHaveCount(0);
  await expect(page.getByLabel("Parent account inactivity timeout")).toHaveCount(0);
  await expect(page.getByLabel("Leader desktop inactivity timeout")).toHaveCount(0);
  await expect(page.getByLabel("Leader phone inactivity timeout")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save Settings" })).toHaveCount(0);
});

test("QM-only users see a clear QM empty state without finance settings", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "QM settings presentation runs on desktop and mobile Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await login(page, "test.group.quartermaster@example.com");
  await page.goto("/leader/settings?view=quartermaster");

  const emptyState = page.getByTestId("qm-settings-empty-state");
  await expect(page.getByTestId("page-qm-settings")).toBeVisible();
  await expect(page.getByRole("heading", { name: "QM Settings", exact: true })).toBeVisible();
  await expect(emptyState.getByRole("heading", { name: "Quartermaster settings", exact: true })).toBeVisible();
  await expect(emptyState.getByRole("status")).toHaveText("No current settings.");
  await expect(page.getByTestId("subs-settings-panel")).toHaveCount(0);
  await expect(page.getByText(/Rate policy|Family Billing Account/i)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save immutable rate policy" })).toHaveCount(0);

  await page.reload();
  await expect(page).toHaveURL(/\/leader\/settings\?view=quartermaster$/);
  await expect(page.getByTestId("qm-settings-empty-state").getByRole("status")).toHaveText("No current settings.");
  await expect(page.getByTestId("subs-settings-panel")).toHaveCount(0);

  const navigation = await exposeQuartermaster(page, testInfo);
  await navigation.getByTestId("leader-nav-qm-settings").click();
  await expect(page).toHaveURL(/\/leader\/settings\?view=quartermaster$/);
  await expect(page.getByTestId("qm-settings-empty-state").getByRole("status")).toHaveText("No current settings.");
});

test("ordinary leader cannot access site settings", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password || !leaderEmail, "Configure canonical E2E leader credentials.");

  await login(page, leaderEmail!);
  await page.goto("/leader/settings");
  await expect(page).toHaveURL(/\/leader$/);

  await page.goto("/leader/settings?view=quartermaster");
  await expect(page).toHaveURL(/\/leader$/);

  await page.getByRole("button", { name: /Leader Menu|Menu ·/ }).click();
  await expect(page.getByRole("link", { name: "Settings" })).toHaveCount(0);
});

test("admin can extend standard and leader family rate tables", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await login(page, "test.webadmin@example.com");
  await page.goto("/leader/settings");

  await expect(page.getByTestId("subs-settings-panel")).toBeVisible();
  await page.getByTestId("subs-add-standard-rate").click();
  const standardFive = page.getByTestId("subs-standard-rate-5");
  await expect(standardFive).toBeVisible();
  await standardFive.getByRole("textbox").fill("734.00");

  await page.getByTestId("subs-add-leader-rate").click();
  const leaderFour = page.getByTestId("subs-leader-rate-4");
  await expect(leaderFour).toBeVisible();
  await leaderFour.getByRole("textbox").fill("570.00");

  await expect(page.getByText(/no amount is inferred/i)).toBeVisible();
  await standardFive.getByRole("textbox").fill("bad");
  await page.getByRole("button", { name: "Save immutable rate policy" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /valid euro amount/i })).toBeVisible();
});

test("saving the already-active immutable subs policy is idempotent", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await login(page, "test.webadmin@example.com");
  await page.goto("/leader/settings?view=treasurer");
  const panel = page.getByTestId("subs-settings-panel");
  await expect(panel.getByTestId("subs-saved-policy-status")).toBeVisible();
  await panel.getByRole("button", { name: "Save immutable rate policy" }).click();
  await expect(panel.getByRole("alert").filter({ hasText: /Subs policy .* saved/ })).toBeVisible();
  await expect(panel.getByRole("alert").filter({ hasText: /Unable to save subs policy|PERMISSION_DENIED/i })).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId("subs-settings-panel").getByTestId("subs-saved-policy-status")).toContainText("version 1");
});

test("Scout-year date range anchors a future end to its start and blocks reversed saves on desktop and mobile", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Scout-year date range runs on desktop and mobile Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await login(page, "test.webadmin@example.com");
  await page.goto("/leader/settings?view=treasurer");
  const panel = page.getByTestId("subs-settings-panel");
  await expect(panel.getByTestId("subs-saved-policy-status")).toBeVisible();
  const start = panel.getByRole("textbox", { name: /^Starts/ });
  const end = panel.getByRole("textbox", { name: "Ends", exact: true });
  const savedStart = await start.inputValue();
  const savedEnd = await end.inputValue();

  await start.fill("");
  await expect(start).toHaveAttribute("aria-invalid", "true");
  await expect(panel.getByText("Enter a valid start date.", { exact: true })).toBeVisible();
  await expect(end).toBeDisabled();

  await start.fill("2099-04-02");
  await expect(end).toBeEnabled();
  await expect(end).toHaveValue("");
  await expect(panel.getByText("The end date was cleared", { exact: false })).toBeVisible();
  await panel.getByRole("button", { name: "Choose ends" }).click();
  const calendar = page.getByRole("dialog", { name: "Choose ends" });
  await expect(calendar.getByRole("button", { name: "Select 01-04-2099" })).toBeDisabled();
  await expect(calendar.getByRole("button", { name: "Select 02-04-2099" })).toHaveAttribute("aria-pressed", "true");
  await calendar.getByRole("button", { name: "Confirm date" }).click();
  await expect(end).not.toHaveValue("");

  await end.fill("01-04-2099");
  await expect(end).toHaveAttribute("aria-invalid", "true");
  await expect(panel.getByText("End date cannot be before the start date.", { exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Save immutable rate policy" }).click();
  await expect(panel.getByText(/Subs period end date must be valid and on or after its start date/)).toBeVisible();

  await page.reload();
  const reloadedPanel = page.getByTestId("subs-settings-panel");
  await expect(reloadedPanel.getByRole("textbox", { name: /^Starts/ })).toHaveValue(savedStart);
  await expect(reloadedPanel.getByRole("textbox", { name: "Ends", exact: true })).toHaveValue(savedEnd);
});
