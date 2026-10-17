import { expect, test, type Browser, type Page, type TestInfo } from "@playwright/test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

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

async function expectPollsAboveOverview(page: Page) {
  await expect.poll(() => page.evaluate(() => {
    const polls = document.querySelector('[data-testid="leader-polls"]');
    const overview = document.querySelector('[data-testid="admin-overview"]');
    return Boolean(polls && overview && (polls.compareDocumentPosition(overview) & Node.DOCUMENT_POSITION_FOLLOWING));
  })).toBe(true);
}

async function publishScopedParentPoll(page: Page, browser: Browser, testInfo: TestInfo) {
  const question = `SW-357 poll assurance ${Date.now()}-${testInfo.testId}`;

  await login(page, "/leader/login", adminEmail!);
  await expect(page.getByTestId("leader-polls")).toBeVisible();
  await page.getByLabel("Poll question").fill(question);
  await page.getByLabel("Answer options").fill("Outdoor activity\nIndoor activity");
  await page.getByRole("combobox", { name: "Poll audience" }).click();
  const audienceOptions = page.getByRole("listbox", { name: "Poll audience" });
  await expect(audienceOptions).toBeVisible();
  await audienceOptions.getByRole("option", { name: "Parents and guardians", exact: true }).press("Enter");
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
  await expect(parentPage.getByTestId("parent-polls")).toBeVisible();
  await expect(parentPage.getByTestId(/^parent-poll-/).filter({ hasText: question })).toHaveCount(0);

  await pollCard.getByRole("button", { name: "Publish poll" }).click();
  await expect(pollCard.getByText(/published/i)).toBeVisible();

  return { question, parentContext, parentPage, pollCard };
}

test.describe("dashboard polls", () => {
  test("SW-357 saves the reported whole-group leader draft and blocks a repeated in-flight submission", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!adminEmail || !password, "Configure the super-admin E2E account.");
    await login(page, "/leader/login", adminEmail!);
    await page.goto("/leader/polls");
    await expect(page.getByTestId("leader-polls")).toBeVisible();
    await page.getByLabel("Poll question").fill("Poll");
    await page.getByLabel("Answer options").fill("Poll1\nPoll2");
    await page.getByRole("combobox", { name: "Poll scope" }).click();
    await page.getByRole("option", { name: "Whole group" }).click();
    const saveDraft = page.getByRole("button", { name: "Save draft" });
    await Promise.all([saveDraft.dispatchEvent("click"), saveDraft.dispatchEvent("click")]);

    const draft = page.getByTestId(/^leader-poll-manager-/).filter({ has: page.getByText("Poll", { exact: true }) });
    await expect(draft).toHaveCount(1);
    await expect(draft).toContainText("Leaders · Whole group · draft");
    await expect(page.getByTestId("leader-polls").getByRole("status").filter({ hasText: "Poll draft saved" })).toBeVisible();
    await expect(page.getByTestId("leader-polls-empty")).toHaveAttribute("role", "status");
    await expect(page.getByTestId("leader-polls").getByRole("alert")).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId(/^leader-poll-manager-/).filter({ has: page.getByText("Poll", { exact: true }) })).toHaveCount(1);
  });

  test("a scoped poll is explicitly published, answered once, and persists after reload", async ({ page, browser }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!parentEmail || !adminEmail || !password, "Configure the approved parent and super-admin E2E accounts.");
    const { question, parentContext, parentPage } = await publishScopedParentPoll(page, browser, testInfo);

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

    // Hold the amendment commit until the pending UI is asserted. This makes
    // the acknowledgement race deterministic instead of relying on CI latency.
    let releaseCommit!: () => void;
    let reachedCommit!: () => void;
    const commitGate = new Promise<void>((resolve) => { releaseCommit = resolve; });
    const commitReached = new Promise<void>((resolve) => { reachedCommit = resolve; });
    const commitUrl = "**/documents:commit?*";
    await parentPage.route(commitUrl, async (route) => {
      if (route.request().method() !== "POST") { await route.continue(); return; }
      reachedCommit();
      await commitGate;
      await route.continue();
    });
    await restoredPoll.getByRole("radio", { name: "Indoor activity" }).check();
    await restoredPoll.getByRole("button", { name: "Save changed response" }).click();
    try {
      await commitReached;
      await expect(restoredPoll.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
      await expect(restoredPoll.getByRole("status")).toContainText("Your response is saved");
    } finally {
      releaseCommit();
    }
    // The saved status belongs to the previous response and remains visible
    // while an amendment is in flight. The enabled action returns only after
    // submitPollResponse settles; wait for it before destroying the page.
    await expect(restoredPoll.getByRole("button", { name: "Save changed response", exact: true })).toBeEnabled();
    await expect(restoredPoll.getByRole("status")).toContainText("Your response is saved");
    await expect(parentPage.getByTestId("parent-polls").getByRole("alert")).toHaveCount(0);
    await parentPage.unroute(commitUrl);
    await parentPage.reload();
    const amendedPoll = parentPage.getByTestId(/^parent-poll-/).filter({ hasText: question });
    await expect(amendedPoll.getByRole("radio", { name: "Indoor activity" })).toBeChecked();

    const cleanupPoll = page.getByTestId(/^leader-poll-manager-/).filter({ hasText: question });
    await cleanupPoll.getByRole("button", { name: "View results" }).click();
    const aggregate = cleanupPoll.getByTestId(/^poll-results-/);
    await expect(aggregate).toContainText("Results · 1 response(s)");
    await expect(aggregate).toContainText("Outdoor activity: 0");
    await expect(aggregate).toContainText("Indoor activity: 1");
    await parentContext.close();
  });

  // Publication is exercised above. Start closure from its own published fixture
  // so UI creation/publication writes do not consume the closure/reload budget.
  test("a published scoped poll closes and disappears from the parent dashboard", async ({ page, browser }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!parentEmail || !adminEmail || !password, "Configure the approved parent and super-admin E2E accounts.");
    if (process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || process.env.FIREBASE_PROJECT_ID !== "demo-coolock-ardlea-scouts") {
      throw new Error("Poll closure fixtures require the local demo Firestore emulator.");
    }
    const firestore = getFirestore(getApps()[0] || initializeApp({ projectId: "demo-coolock-ardlea-scouts" }));
    const pollRef = firestore.collection("polls").doc();
    const question = `SW-357 closure ${pollRef.id}`;
    const options = ["Outdoor activity", "Indoor activity"];
    const scope = { audienceType: "parents", scopeType: "sections", scopeSections: ["Beavers"], status: "published" };
    const batch = firestore.batch();
    batch.set(pollRef, { ...scope, question, options, createdBy: "e2e-poll-fixture", updatedBy: "e2e-poll-fixture", createdAt: Timestamp.now(), updatedAt: Timestamp.now(), publishedAt: Timestamp.now() });
    batch.set(pollRef.collection("audienceSections").doc("Beavers"), { ...scope, pollId: pollRef.id, section: "Beavers" });
    options.forEach((option, optionIndex) => batch.set(pollRef.collection("results").doc(String(optionIndex)), { option, optionIndex, count: 0 }));
    await batch.commit();
    const parentContext = await browser.newContext();
    try {
      const parentPage = await parentContext.newPage();
      await login(page, "/leader/login", adminEmail!);
      await login(parentPage, "/parent", parentEmail!);
      const cleanupPoll = page.getByTestId(/^leader-poll-manager-/).filter({ hasText: question });
      await expect(cleanupPoll).toContainText("published");
      await parentPage.reload();
      const parentPoll = parentPage.getByTestId(/^parent-poll-/).filter({ hasText: question });
      await expect(parentPoll).toBeVisible();
      await parentPoll.getByRole("radio", { name: "Outdoor activity" }).check();
      await parentPoll.getByRole("button", { name: "Save response" }).click();
      await expect(parentPoll.getByRole("status")).toContainText("Your response is saved");
      await cleanupPoll.getByRole("button", { name: "Close poll" }).click();
      await expect(cleanupPoll.getByText(/closed/i)).toBeVisible();
      await expect(cleanupPoll.getByRole("button", { name: "View results" })).toBeVisible();
      await parentPage.reload();
      await expect(parentPage.getByTestId("parent-polls")).toBeVisible();
      await expect(parentPage.getByTestId(/^parent-poll-/).filter({ hasText: question })).toHaveCount(0);
      await page.reload();
      await expect(page.getByTestId(/^leader-poll-manager-/).filter({ hasText: question })).toContainText("closed");
    } finally {
      await parentContext.close();
      await firestore.recursiveDelete(pollRef);
    }
  });

  test("SW-407 shows eligible leader polls first and refreshes aggregate results", async ({ page, browser }, testInfo) => {
    desktopOnly(testInfo);
    const cubsLeaderEmail = process.env.E2E_CUBS_SECTION_LEADER_EMAIL || "test.cub.section.leader@example.com";
    test.skip(!adminEmail || !password, "Configure the super-admin E2E account.");
    const question = `SW-407 leader dashboard poll ${Date.now()}`;

    await login(page, "/leader/login", adminEmail!);
    await page.goto("/leader/polls");
    await page.getByLabel("Poll question").fill(question);
    await page.getByLabel("Answer options").fill("Hike\nCamp");
    await page.getByRole("combobox", { name: "Poll audience" }).click();
    await page.getByRole("option", { name: "Leaders", exact: true }).click();
    await expect(page.getByRole("listbox")).toBeHidden();
    await page.getByRole("combobox", { name: "Poll scope" }).click();
    await page.getByRole("option", { name: "Selected sections" }).click();
    await expect(page.getByRole("listbox")).toBeHidden();
    for (const checkbox of await page.getByTestId("poll-create-form").getByRole("checkbox").all()) {
      if (await checkbox.isChecked()) await checkbox.uncheck();
    }
    await page.getByRole("checkbox", { name: "Cubs" }).check();
    await page.getByRole("button", { name: "Save draft" }).click();
    const managerPoll = page.getByTestId(/^leader-poll-manager-/).filter({ hasText: question });
    await expect(managerPoll).toBeVisible();
    await managerPoll.getByRole("button", { name: "Publish poll" }).click();
    await expect(managerPoll).toContainText("published");

    const leaderContext = await browser.newContext();
    const leaderPage = await leaderContext.newPage();
    await login(leaderPage, "/leader/login", cubsLeaderEmail);
    await expectPollsAboveOverview(leaderPage);
    const leaderPoll = leaderPage.locator('[data-testid^="leader-poll-"]:not([data-testid^="leader-poll-manager-"])').filter({ hasText: question });
    await expect(leaderPoll).toHaveCount(1);
    await expect(leaderPoll.getByRole("radio", { name: "Hike" })).toBeVisible();
    await expect(leaderPoll.getByTestId(/^leader-poll-audience-results-/)).toHaveCount(0);
    await leaderPoll.getByRole("radio", { name: "Hike" }).check();
    await leaderPoll.getByRole("button", { name: "Save response" }).click();
    await expect(leaderPoll.getByRole("status").filter({ hasText: "Saved choice: Hike" })).toBeVisible();
    const audienceResults = leaderPoll.getByTestId(/^leader-poll-audience-results-/);
    await expect(audienceResults).toContainText("Current results · 1 response(s)");
    await expect(audienceResults).toContainText("Hike: 1 (100%)");
    await leaderPoll.getByRole("radio", { name: "Camp" }).check();
    await leaderPoll.getByRole("button", { name: "Save changed response" }).click();
    await expect(leaderPoll.getByRole("status").filter({ hasText: "Saved choice: Camp" })).toBeVisible();
    await expect(audienceResults).toContainText("Current results · 1 response(s)");
    await expect(audienceResults).toContainText("Hike: 0 (0%)");
    await expect(audienceResults).toContainText("Camp: 1 (100%)");

    const secondLeaderEmail = process.env.E2E_CUBS_SECOND_SECTION_LEADER_EMAIL;
    if (secondLeaderEmail) {
      const secondContext = await browser.newContext();
      const secondPage = await secondContext.newPage();
      await login(secondPage, "/leader/login", secondLeaderEmail);
      const secondPoll = secondPage.locator('[data-testid^="leader-poll-"]:not([data-testid^="leader-poll-manager-"])').filter({ hasText: question });
      await secondPoll.getByRole("radio", { name: "Hike" }).check();
      await secondPoll.getByRole("button", { name: "Save response" }).click();
      await expect(leaderPoll.getByTestId(/^leader-poll-audience-results-/)).toContainText("Current results · 2 response(s)");
      await secondContext.close();
    }

    await leaderPage.reload();
    const restoredPoll = leaderPage.locator('[data-testid^="leader-poll-"]:not([data-testid^="leader-poll-manager-"])').filter({ hasText: question });
    await expect(restoredPoll.getByRole("radio", { name: "Camp" })).toBeChecked();
    await expect(restoredPoll.getByRole("status").filter({ hasText: "Saved choice: Camp" })).toBeVisible();
    await expect(restoredPoll.getByTestId(/^leader-poll-audience-results-/)).toContainText(secondLeaderEmail ? "Current results · 2 response(s)" : "Current results · 1 response(s)");
    await leaderContext.close();
    await managerPoll.getByRole("button", { name: "Close poll" }).click();
  });

  test("a Super Admin can manage a leader poll outside their voting sections", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    test.skip(!adminEmail || !password, "Configure the super-admin E2E account.");
    const question = `SW-357 manager-only leader poll ${Date.now()}`;

    await login(page, "/leader/login", adminEmail!);
    await page.goto("/leader/polls");
    await page.getByLabel("Poll question").fill(question);
    await page.getByLabel("Answer options").fill("Hike\nCamp");
    await page.getByRole("combobox", { name: "Poll scope" }).click();
    await page.getByRole("option", { name: "Whole group" }).click();
    await expect(page.getByRole("listbox")).toBeHidden();
    await page.getByRole("button", { name: "Save draft" }).click();

    const pollCard = page.getByTestId(/^leader-poll-manager-/).filter({ hasText: question });
    await expect(pollCard).toBeVisible();
    const managerTestId = await pollCard.getAttribute("data-testid");
    const pollId = managerTestId?.replace("leader-poll-manager-", "");
    expect(pollId).toBeTruthy();
    await pollCard.getByRole("button", { name: "Publish poll" }).click();
    await expect(pollCard.getByText(/published/i)).toBeVisible();
    await expect(page.getByTestId("leader-polls").getByRole("alert")).toHaveCount(0);
    await expect(page.getByTestId(`leader-poll-${pollId}`)).toHaveCount(0);

    await pollCard.getByRole("button", { name: "View results" }).click();
    await expect(pollCard.getByTestId(/^poll-results-/)).toContainText("Results · 0 response(s)");
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
    await expectPollsAboveOverview(page);

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
