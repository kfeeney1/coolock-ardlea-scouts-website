import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const password = process.env.E2E_TEST_USER_PASSWORD;
const ownedAccounts: string[] = [];

test.afterEach(async () => {
  if (ownedAccounts.length === 0) return;
  if (process.env.FIREBASE_PROJECT_ID !== "demo-coolock-ardlea-scouts" || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099") throw new Error("Identity fixture cleanup requires local demo emulators.");
  const app = getApps()[0];
  const db = getFirestore(app);
  for (const uid of ownedAccounts.splice(0)) {
    const batch = db.batch();
    for (const collection of ["adminUsers", "organisationLeadership", "parentAccounts"]) batch.delete(db.doc(`${collection}/${uid}`));
    await batch.commit();
    await getAuth(app).deleteUser(uid);
  }
});

test.beforeEach(({}, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Context switching runs on desktop and mobile Chromium.");
  test.skip(!password, "Configure canonical E2E credentials.");
});

async function signIn(page: Page, email: string, leader: boolean) {
  await page.goto(leader ? "/leader/login" : "/parent");
  await page.getByRole("textbox", { name: leader ? "Email address" : "Email", exact: true }).fill(email);
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(password!);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("heading", { name: leader ? "Leader Dashboard" : "Parent Portal", exact: true })).toBeVisible();
}

async function openParentFromHeader(page: Page, testInfo: TestInfo) {
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.getByRole("menuitem", { name: "Parent Portal", exact: true }).click();
  } else {
    await page.getByRole("banner").getByRole("link", { name: "Parent Portal", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "Parent Portal", exact: true })).toBeVisible();
}

async function signOutFromHeader(page: Page, testInfo: TestInfo) {
  if (testInfo.project.name === "mobile-chromium") {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await page.getByRole("menuitem", { name: "Sign Out", exact: true }).click();
  } else {
    await page.getByRole("banner").getByRole("button", { name: "Sign Out", exact: true }).click();
  }
  await expect(page).toHaveURL(/\/$/);
}

async function expectChildOptions(page: Page, count: number) {
  const select = page.getByRole("combobox", { name: "Viewing information for" });
  await expect(select).toBeVisible();
  await select.click();
  await expect(page.getByRole("option")).toHaveCount(count);
  const ids = await page.getByRole("option").evaluateAll((options) => options.map((option) => option.getAttribute("data-value")));
  await page.getByRole("option").first().click();
  return ids;
}

test("combined leader and parent can switch contexts, reload and sign in again with only linked children", async ({ page }, testInfo) => {
  const email = process.env.E2E_PARENT_LEADER_EMAIL;
  test.skip(!email, "Configure canonical combined account.");
  await signIn(page, email!, true);
  await openParentFromHeader(page, testInfo);
  await expect(page.getByText("Your account is approved and linked to 2 member records.")).toBeVisible();
  const children = await expectChildOptions(page, 2);
  expect(children).toEqual(["TEST_member_beaver_05", "TEST_member_beaver_06"]);
  await page.getByRole("combobox", { name: "Viewing information for" }).click();
  await page.locator('[role="option"][data-value="TEST_member_beaver_06"]').click();
  await expect(page).toHaveURL(/child=TEST_member_beaver_06/);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Viewing information for" })).toBeVisible();
  await expect(page).toHaveURL(/child=TEST_member_beaver_06/);
  await page.goto("/parent?child=TEST_member_beaver_01");
  await expect(page).toHaveURL(/child=TEST_member_beaver_05/);
  await expectChildOptions(page, 2);
  // Firebase may still be hydrating the persisted leader session after the
  // parent route reload. Wait for the document, then assert the protected
  // route resolves to Member Management below.
  await page.goto("/leader/members", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Member Management", exact: true })).toBeVisible();
  await expect(page.getByTestId("member-card-TEST_member_beaver_01")).toBeVisible();
  await page.goto("/parent");
  await expect(page.getByText("Your account is approved and linked to 2 member records.")).toBeVisible();
  await signOutFromHeader(page, testInfo);
  await signIn(page, email!, true);
  await page.goto("/parent");
  await expectChildOptions(page, 2);
});

test("leaving Parent Portal cancels a pending child selection commit", async ({ page }, testInfo) => {
  const email = process.env.E2E_PARENT_LEADER_EMAIL;
  test.skip(!email, "Configure canonical combined account.");
  await signIn(page, email!, true);
  await openParentFromHeader(page, testInfo);
  await expect(page.getByRole("combobox", { name: "Viewing information for" })).toBeVisible();

  await page.getByRole("combobox", { name: "Viewing information for" }).click();
  await page.locator('[role="option"][data-value="TEST_member_beaver_06"]').click();
  await page.route("**/leader/members", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    await route.continue();
  });

  // Schedule in the current document before navigation; evaluating from the
  // paused document-request handler can wait for that same navigation to finish.
  await page.evaluate(() => {
    window.setTimeout(() => document.body.classList.add("departure-regression"), 250);
  });
  const response = await page.goto("/leader/members");
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "Member Management", exact: true })).toBeVisible();
});

test("reloading Parent Portal after closing a select preserves the destination", async ({ page }, testInfo) => {
  const email = process.env.E2E_PARENT_LEADER_EMAIL;
  test.skip(!email, "Configure canonical combined account.");
  await signIn(page, email!, true);
  await openParentFromHeader(page, testInfo);
  const select = page.getByRole("combobox", { name: "Viewing information for" });
  await expect(page).toHaveURL(/child=TEST_member_beaver_05/);
  await select.click();
  await page.locator('[role="option"][data-value="TEST_member_beaver_05"]').click();
  await page.route("**/parent?child=TEST_member_beaver_05", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    await route.continue();
  });
  await page.evaluate(() => {
    window.setTimeout(() => document.body.classList.add("reload-regression"), 250);
  });
  const response = await page.reload();
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/parent\?child=TEST_member_beaver_05$/);
  await expect(select).toBeVisible();
  await expect(page.getByRole("heading", { name: "Parent Portal", exact: true })).toBeVisible();
});

test("parent-only account retains portal navigation and cannot enter Leader Dashboard", async ({ page }, testInfo) => {
  const email = process.env.E2E_PARENT_EMAIL;
  test.skip(!email, "Configure canonical parent account.");
  await signIn(page, email!, false);
  await page.goto("/about");
  await openParentFromHeader(page, testInfo);
  await expectChildOptions(page, 2);
  await page.goto("/leader");
  await expect(page).toHaveURL(/\/parent(?:\?.*)?$/);
  await expect(page.getByText("This account does not have leader access.")).toBeVisible();
});

test("leader-only account can reach parent registration without receiving child access", async ({ page }, testInfo) => {
  const email = process.env.E2E_LEADER_EMAIL;
  test.skip(!email, "Configure canonical leader account.");
  await signIn(page, email!, true);
  await openParentFromHeader(page, testInfo);
  await expect(page.getByText(/Submit parent registration by identifying your child/)).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Viewing information for" })).toHaveCount(0);
  await expect(page.getByTestId("parent-portal-menu")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/Submit parent registration by identifying your child/)).toBeVisible();
  await page.goto("/leader");
  await expect(page.getByRole("heading", { name: "Leader Dashboard", exact: true })).toBeVisible();
});

test("combined identity with one child outside its leader section retains independent parent scope", async ({ page }, testInfo) => {
  if (process.env.FIREBASE_PROJECT_ID !== "demo-coolock-ardlea-scouts" || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099") throw new Error("Identity fixture requires local demo emulators.");
  const app = getApps()[0] || initializeApp({ projectId: "demo-coolock-ardlea-scouts" });
  const email = `test.dual.${randomUUID().slice(0, 8)}@example.com`;
  const uid = (await getAuth(app).createUser({ email, password: password! })).uid;
  ownedAccounts.push(uid);
  const db = getFirestore(app);
  await db.doc(`adminUsers/${uid}`).set({ active: true, role: "leader", displayName: "Dual Context Fixture", email, sections: ["Scouts"] });
  await db.doc(`organisationLeadership/${uid}`).set({ active: true, displayName: "Dual Context Fixture", scoutingRole: "Programme Scouter", organisationSection: "Scouts", appointments: [{ appointment: "Programme Scouter", scope: "Scouts", active: true }] });
  await db.doc(`parentAccounts/${uid}`).set({ uid, email, displayName: "Dual Context Fixture", mobileNumber: "0871234567", status: "approved", memberIds: ["TEST_member_beaver_01"], linkedSections: ["Beavers"], requestedChildren: [] });
  await signIn(page, email, true);
  await openParentFromHeader(page, testInfo);
  await expect(page.getByText("Your account is approved and linked to 1 member record.")).toBeVisible();
  expect(await expectChildOptions(page, 1)).toEqual(["TEST_member_beaver_01"]);
  await page.goto("/parent?child=TEST_member_beaver_02");
  await expect(page).toHaveURL(/child=TEST_member_beaver_01/);
  await page.reload();
  expect(await expectChildOptions(page, 1)).toEqual(["TEST_member_beaver_01"]);
  await page.goto("/leader/members");
  await expect(page.getByRole("heading", { name: "Member Management", exact: true })).toBeVisible();
  await expect(page.getByRole("status", { name: "Loading member records" })).toHaveCount(0);
  await expect(page.getByTestId("member-card-TEST_member_scout_01")).toBeVisible();
  await expect(page.getByTestId("member-card-TEST_member_beaver_02")).toHaveCount(0);
});
