import { expect, test, type Page, type TestInfo } from "@playwright/test";

const parentEmail = process.env.E2E_PARENT_EMAIL;
const adminEmail = process.env.E2E_SUPER_ADMIN_EMAIL;
const password = process.env.E2E_TEST_USER_PASSWORD;
const eligibleLeaders = [
  { role: "Superuser", email: adminEmail || "superadmin@example.com" },
  { role: "Cubs leader", email: process.env.E2E_CUBS_SECTION_LEADER_EMAIL || "test.cub.section.leader@example.com" },
  { role: "Group Leader", email: process.env.E2E_GROUP_LEADER_EMAIL || "test.group.leader@example.com" }
];

async function login(page: Page, path: string, email: string) {
  await page.goto(path);
  await page.getByLabel(path === "/parent" ? "Email" : "Email address").fill(email);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  // Wait for the authenticated route before navigating elsewhere: an immediate
  // goto can cancel the in-flight sign-in and leave the dashboard unauthorised.
  if (path === "/leader/login") {
    await expect(page).toHaveURL(/\/leader(?:[?#]|$)/);
    await expect(page.getByTestId("leader-polls")).toBeVisible();
  } else {
    await expect(page.getByRole("button", { name: "Sign Out" }).first()).toBeVisible();
  }
}

function desktopOnly(testInfo: TestInfo) {
  test.skip(testInfo.project.name !== "chromium", "Poll publishing and vote persistence run once on desktop Chromium.");
}

test.describe("dashboard polls", () => {
  test("a scoped poll is explicitly published, answered once, and persists after reload", async ({ page, browser }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!parentEmail || !adminEmail || !password, "Configure the approved parent and super-admin E2E accounts.");
    const question = `SW-357 poll assurance ${Date.now()}`;

    await login(page, "/leader/login", adminEmail!);
    await expect(page.getByTestId("leader-polls")).toBeVisible();
    await page.getByLabel("Poll question").fill(question);
    await page.getByLabel("Answer options").fill("Outdoor activity\nIndoor activity");
    await page.getByRole("combobox", { name: "Poll audience" }).click();
    await page.getByRole("option", { name: "Parents and guardians" }).click();
    // The preceding MUI menu exits asynchronously. Wait for its overlay to
    // disappear before clicking the adjacent scope control.
    await expect(page.getByRole("listbox")).toBeHidden();
    await expect(page.getByRole("combobox", { name: "Poll audience" })).toHaveText("Parents and guardians");
    await page.getByRole("combobox", { name: "Poll scope" }).click();
    await expect(page.getByRole("listbox", { name: "Poll scope" })).toBeVisible();
    await page.getByRole("option", { name: "Selected sections" }).click();
    await expect(page.getByRole("listbox")).toBeHidden();
    const beavers = page.getByRole("checkbox", { name: "Beavers" });
    for (const checkbox of await page.getByTestId("poll-create-form").getByRole("checkbox").all()) {
      if (await checkbox.isChecked()) await checkbox.uncheck();
    }
    await beavers.check();
    await page.getByRole("button", { name: "Save draft" }).click();
    // Surface Firestore permission/index errors at their source instead of timing out
    // on an absent management card with no actionable diagnostics.
    await expect.poll(async () => {
      const error = await page.getByTestId("leader-polls").getByRole("alert").allTextContents();
      if (error.length) return `Poll draft failed: ${error.join(" | ")}`;
      const card = page.getByTestId(/^leader-poll-manager-/).filter({ hasText: question });
      return await card.isVisible() ? "draft visible" : "waiting for draft";
    }, { message: "Poll draft must save and become visible without Firestore errors" }).toBe("draft visible");
    const pollCard = page.getByTestId(/^leader-poll-manager-/).filter({ hasText: question });
    await expect(pollCard).toBeVisible();
    await expect(pollCard.getByRole("button", { name: "Publish poll" })).toBeVisible();

    const parentContext = await browser.newContext();
    const parentPage = await parentContext.newPage();
    await login(parentPage, "/parent", parentEmail!);
    await expect(parentPage.getByTestId(/^parent-poll-/).filter({ hasText: question })).toHaveCount(0);

    await pollCard.getByRole("button", { name: "Publish poll" }).click();
    await expect(pollCard.getByText(/published/i)).toBeVisible();

    await parentPage.reload();
    const parentPoll = parentPage.getByTestId(/^parent-poll-/).filter({ hasText: question });
    await expect(parentPoll).toBeVisible();
    await parentPoll.getByRole("radio", { name: "Outdoor activity" }).check();
    await parentPoll.getByRole("button", { name: "Save response" }).click();
    await expect(parentPoll.getByRole("status")).toContainText("Your response is saved");
    await parentPage.reload();
    const restoredPoll = parentPage.getByTestId(/^parent-poll-/).filter({ hasText: question });
    await expect(restoredPoll.getByRole("radio", { name: "Outdoor activity" })).toBeChecked();
    await expect(restoredPoll.getByRole("status")).toContainText("Your response is saved");
    await expect(restoredPoll.getByRole("button", { name: "View results" })).toHaveCount(0);

    await restoredPoll.getByRole("radio", { name: "Indoor activity" }).check();
    await restoredPoll.getByRole("button", { name: "Save changed response" }).click();
    await expect(restoredPoll.getByRole("status")).toContainText("Your response is saved");
    await parentPage.reload();
    const amendedPoll = parentPage.getByTestId(/^parent-poll-/).filter({ hasText: question });
    await expect(amendedPoll.getByRole("radio", { name: "Indoor activity" })).toBeChecked();

    const cleanupPoll = page.getByTestId(/^leader-poll-manager-/).filter({ hasText: question });
    await cleanupPoll.getByRole("button", { name: "View results" }).click();
    const aggregate = cleanupPoll.getByTestId(/^poll-results-/);
    await expect(aggregate).toContainText("Results · 1 response(s)");
    await expect(aggregate).toContainText("Outdoor activity: 0");
    await expect(aggregate).toContainText("Indoor activity: 1");
    await cleanupPoll.getByRole("button", { name: "Close poll" }).click();
    await expect(cleanupPoll.getByText(/closed/i)).toBeVisible();
    await expect(cleanupPoll.getByRole("button", { name: "View results" })).toBeVisible();
    await parentPage.reload();
    await expect(parentPage.getByTestId(/^parent-poll-/).filter({ hasText: question })).toHaveCount(0);
    await parentContext.close();
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


for (const account of eligibleLeaders) {
  test(`SW-357 ${account.role} reaches the distinct Group Polls page from navigation, direct URL, reload and Back`, async ({ page }, testInfo) => {
    test.skip(!password, "Configure the approved E2E leader password.");
    await page.setViewportSize(testInfo.project.name === "mobile-chromium" ? { width: 393, height: 852 } : { width: 1440, height: 960 });
    await login(page, "/leader/login", account.email);

    await page.goto("/leader/polls");
    await expect(page).toHaveURL(/\/leader\/polls$/);
    await expect(page.getByRole("heading", { name: "Group Polls", level: 1 })).toBeVisible();
    await expect(page.getByTestId("leader-polls")).toBeVisible();
    await expect(page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).resolves.toBe(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Group Polls", level: 1 })).toBeVisible();
    await expect(page.getByTestId("leader-polls")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/leader$/);
    await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
    await expect(page.getByTestId("leader-polls")).toBeVisible();

    await page.getByRole("button", { name: /Open Leader Menu|Menu ·/ }).click();
    if (testInfo.project.name === "mobile-chromium") await page.getByRole("button", { name: "Programme", exact: true }).click();
    const pollLink = page.getByTestId("leader-nav-group-polls").filter({ visible: true });
    await expect(pollLink).toBeVisible();
    await pollLink.click();
    await expect(page).toHaveURL(/\/leader\/polls$/);
    await expect(page.getByRole("heading", { name: "Group Polls", level: 1 })).toBeVisible();
    await expect(page.getByTestId("leader-polls")).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu · Group Polls" })).toBeVisible();

    await page.getByRole("button", { name: /Menu · Group Polls/ }).click();
    await expect(page.getByTestId("leader-nav-group-polls").filter({ visible: true })).toHaveAttribute("aria-current", "page");
  });
}

test("SW-357 parent accounts remain on the Parent Portal when opening the restricted leader polls route", async ({ page }) => {
  test.skip(!parentEmail || !password, "Configure the approved parent E2E account.");
  await login(page, "/parent", parentEmail!);
  await page.goto("/leader/polls");
  await expect(page).toHaveURL(/\/parent$/);
  await expect(page.getByTestId("parent-polls")).toBeVisible();
  await expect(page.getByTestId("leader-polls")).toHaveCount(0);
});
