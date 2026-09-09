import { expect, test, type Page, type TestInfo } from "@playwright/test";

type Credentials = { email: string; password: string };

function adminCredentials(): Credentials | null {
  const email = process.env.E2E_ADMIN_EMAIL?.trim();
  const password = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_TEST_USER_PASSWORD;
  return email && password ? { email, password } : null;
}

async function loginLeader(page: Page, account: Credentials) {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(account.email);
  await page.getByLabel("Password").fill(account.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Equipment report downloads run once on desktop Chromium.");
}

test("equipment manager can export the full inventory and a filtered report", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  const account = adminCredentials();
  test.skip(!account, "Configure the seeded E2E admin account to run this check.");
  await loginLeader(page, account!);

  await page.goto("/leader/equipment");
  await expect(page.getByRole("heading", { name: "Equipment & Stores" })).toBeVisible();
  const reports = page.getByTestId("equipment-reports-panel");
  await expect(reports.getByRole("heading", { name: "Equipment Reports" })).toBeVisible();

  const allDownloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-all-equipment-csv").click();
  const allDownload = await allDownloadPromise;
  expect(allDownload.suggestedFilename()).toMatch(/^all-equipment-\d{4}-\d{2}-\d{2}\.csv$/);
  const allContent = await allDownload.createReadStream().then(async (stream) => {
    let value = "";
    for await (const chunk of stream) value += chunk.toString();
    return value;
  });
  expect(allContent).toContain("TEST Patrol Tents");

  await reports.getByLabel("Report").click();
  await page.getByRole("option", { name: "Current Section Holdings" }).click();
  const selectedDownloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-selected-equipment-report").click();
  const selectedDownload = await selectedDownloadPromise;
  expect(selectedDownload.suggestedFilename()).toMatch(/^current-section-holdings-\d{4}-\d{2}-\d{2}\.csv$/);

  const registerDownloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-equipment-asset-register").click();
  const registerDownload = await registerDownloadPromise;
  expect(registerDownload.suggestedFilename()).toMatch(/^equipment-asset-register-\d{4}-\d{2}-\d{2}\.csv$/);
  const registerContent = await registerDownload.createReadStream().then(async (stream) => {
    let value = "";
    for await (const chunk of stream) value += chunk.toString();
    return value;
  });
  expect(registerContent).toContain('"Date Purchased","Quantity","Description"');
  expect(registerContent).toContain('"8","TEST Patrol Tents"');
});

test("ordinary leaders cannot access equipment reports", async ({ page }, testInfo) => {
  desktopOnly(testInfo);
  const email = process.env.E2E_MULTI_SECTION_LEADER_EMAIL?.trim();
  const password = process.env.E2E_TEST_USER_PASSWORD;
  test.skip(!email || !password, "Configure the seeded ordinary leader account to run this check.");
  await loginLeader(page, { email: email!, password: password! });
  await page.goto("/leader/equipment");
  await expect(page.getByRole("heading", { name: "Equipment & Stores" })).toBeVisible();
  await expect(page.getByTestId("equipment-reports-panel")).toHaveCount(0);
  await expect(page.getByTestId("export-equipment-asset-register")).toHaveCount(0);
});
