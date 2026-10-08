import { expect, test, type Page, type TestInfo } from "@playwright/test";

const parentEmail = process.env.E2E_PARENT_EMAIL;
const adminEmail = process.env.E2E_SUPER_ADMIN_EMAIL;
const password = process.env.E2E_TEST_USER_PASSWORD;

async function login(page: Page, path: string, email: string) {
  await page.goto(path);
  await page.getByLabel(path === "/parent" ? "Email" : "Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
}

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Poll publishing and vote persistence run once on desktop Chromium.");
}

test.describe("dashboard polls", () => {
  test("a scoped poll is explicitly published, answered once, and persists after reload", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!parentEmail || !adminEmail || !password, "Configure the approved parent and super-admin E2E accounts.");
    const question = `SW-357 poll assurance ${Date.now()}`;

    await login(page, "/leader/login", adminEmail!);
    await page.goto("/leader");
    await expect(page.getByTestId("leader-polls")).toBeVisible();
    await page.getByLabel("Poll question").fill(question);
    await page.getByLabel("Answer options").fill("Outdoor activity\nIndoor activity");
    await page.getByRole("combobox", { name: "Poll audience" }).click();
    await page.getByRole("option", { name: "Parents and guardians" }).click();
    const beavers = page.getByRole("checkbox", { name: "Beavers" });
    if (!(await beavers.isChecked())) await beavers.check();
    await page.getByRole("button", { name: "Save draft" }).click();
    const pollCard = page.getByTestId(/^leader-poll-manager-/).filter({ hasText: question });
    await expect(pollCard).toBeVisible();
    await expect(pollCard.getByRole("button", { name: "Publish poll" })).toBeVisible();
    await pollCard.getByRole("button", { name: "Publish poll" }).click();
    await expect(pollCard.getByText(/published/i)).toBeVisible();

    await login(page, "/parent", parentEmail!);
    const parentPoll = page.getByTestId(/^parent-poll-/).filter({ hasText: question });
    await expect(parentPoll).toBeVisible();
    await parentPoll.getByRole("radio", { name: "Outdoor activity" }).check();
    await parentPoll.getByRole("button", { name: "Save response" }).click();
    await expect(parentPoll.getByRole("status")).toContainText("Your response is saved");
    await page.reload();
    const restoredPoll = page.getByTestId(/^parent-poll-/).filter({ hasText: question });
    await expect(restoredPoll.getByRole("radio", { name: "Outdoor activity" })).toBeChecked();
    await expect(restoredPoll.getByRole("status")).toContainText("Your response is saved");

    await login(page, "/leader/login", adminEmail!);
    await page.goto("/leader");
    const cleanupPoll = page.getByTestId(/^leader-poll-manager-/).filter({ hasText: question });
    await cleanupPoll.getByRole("button", { name: "Close poll" }).click();
    await expect(cleanupPoll.getByText(/closed/i)).toBeVisible();
  });

  test("the parent poll dashboard fits desktop and mobile viewports", async ({ page }, testInfo) => {
    test.skip(!parentEmail || !password, "Configure the approved parent E2E account.");
    const mobile = testInfo.project.name === "mobile-chromium";
    await page.setViewportSize(mobile ? { width: 393, height: 852 } : { width: 1440, height: 960 });
    await login(page, "/parent", parentEmail!);
    await expect(page.getByRole("heading", { name: "Group Polls" })).toBeVisible();
    await expect(page.getByTestId("parent-polls")).toBeVisible();
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);
  });
});
