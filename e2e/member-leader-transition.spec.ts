import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const password = process.env.E2E_TEST_USER_PASSWORD;

const ownedMembers: { memberId: string; email: string; invitationId?: string }[] = [];

function fixtureApp() {
  if (process.env.FIREBASE_PROJECT_ID !== "demo-coolock-ardlea-scouts" || process.env.FIRESTORE_EMULATOR_HOST !== "127.0.0.1:8080" || process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099") throw new Error("Identity fixture requires local demo emulators.");
  return getApps()[0] || initializeApp({ projectId: "demo-coolock-ardlea-scouts" });
}

test.afterEach(async () => {
  if (ownedMembers.length === 0) return;
  const app = fixtureApp();
  const db = getFirestore(app);
  for (const fixture of ownedMembers.splice(0)) {
    let uid = "";
    try { uid = (await getAuth(app).getUserByEmail(fixture.email)).uid; }
    catch (error) { if ((error as { code?: string }).code !== "auth/user-not-found") throw error; }
    const batch = db.batch();
    batch.delete(db.doc(`members/${fixture.memberId}`));
    if (fixture.invitationId) batch.delete(db.doc(`leaderTransitionInvitations/${fixture.invitationId}`));
    const history = await db.collection("memberHistory").where("memberId", "==", fixture.memberId).get();
    history.docs.forEach((entry) => batch.delete(entry.ref));
    if (uid) for (const collection of ["adminUsers", "organisationLeadership", "leaderRegistrationRequests", "parentAccounts"]) batch.delete(db.doc(`${collection}/${uid}`));
    await batch.commit();
    if (uid) await getAuth(app).deleteUser(uid);
  }
});

test("cancelling member-to-leader transition leaves member status unchanged", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Member transition runs on desktop and mobile Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill("test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await page.goto("/leader/members");

  const member = page.getByTestId("member-card-TEST_member_beaver_01");
  await expect(member).toBeVisible();
  await expect(member).toContainText("Active");
  await member.getByRole("button", { name: "Manage" }).click();
  await page.getByRole("button", { name: "Transition to Leader" }).click();

  const dialog = page.getByRole("dialog", { name: "Transition member to Leader" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("No membership or leader access changes until the member submits and an administrator approves the request.");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("combobox").filter({ hasText: "Active" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox").filter({ hasText: "Active" })).toBeVisible();
  await page.getByRole("link", { name: "Back to Member Management" }).click();
  await expect(member).toContainText("Active");
});

test("invalid member transition link cannot submit a Leader Registration", async ({ page }) => {
  await page.goto("/leader/register?transition=invalid");
  await expect(page.getByText("This leader registration link is invalid.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit Leader Registration" })).toBeDisabled();
});

async function completeTransition(page: import("@playwright/test").Page, section: "Cubs" | "Rovers", endMembership: boolean, existingAccount = false) {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { (window as Window & { __transitionCopied?: string }).__transitionCopied = value; } } }));
  const suffix = randomUUID().slice(0, 8);
  const firstName = "TEST Transition";
  const lastName = `Member${suffix}`;
  const email = `test.transition.${suffix}@example.com`;
  const passwordForMember = `Transition-${suffix}-P455!`;

  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill("test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await page.goto("/leader/members");
  await page.getByRole("button", { name: "Add Member", exact: true }).click();
  const addDialog = page.getByRole("dialog", { name: "Add Existing Member" });
  await addDialog.getByLabel("First name").fill(firstName);
  await addDialog.getByLabel("Last name").fill(lastName);
  await addDialog.getByLabel("Date of birth").fill("2000-01-01");
  await addDialog.getByRole("checkbox", { name: "Beavers", exact: true }).uncheck();
  await addDialog.getByRole("checkbox", { name: section, exact: true }).check();
  await addDialog.getByLabel("Email address").fill(email);
  await addDialog.getByLabel("Mobile number").fill("0871234567");
  await addDialog.getByRole("button", { name: "Add Member", exact: true }).click();
  await expect(addDialog).toBeHidden();

  const member = page.locator(`[data-testid^="member-card-"][data-member-last-name="${lastName}"]`);
  await expect(member).toBeVisible();
  const memberId = (await member.getAttribute("data-testid"))!.replace("member-card-", "");
  const fixture: { memberId: string; email: string; invitationId?: string } = { memberId, email };
  ownedMembers.push(fixture);
  let existingUid = "";
  let original: Record<string, unknown> | undefined;
  if (existingAccount) {
    const app = fixtureApp();
    existingUid = (await getAuth(app).createUser({ email, password: passwordForMember })).uid;
    const db = getFirestore(app);
    await db.collection("members").doc(memberId).update({ accountUid: existingUid, familyId: `transition-family-${suffix}`, sections: ["Cubs", "Rovers"], sectionRoles: { Cubs: "Sixer", Rovers: "Crew Leader" } });
    original = (await db.collection("members").doc(memberId).get()).data();
    await db.collection("parentAccounts").doc(existingUid).set({ uid: existingUid, email, displayName: `${firstName} ${lastName}`, mobileNumber: "0871234567", status: "approved", memberIds: ["TEST_member_beaver_01"], linkedSections: ["Beavers"], requestedChildren: [] });
    await page.reload();
    await expect(member).toBeVisible();
  }
  await member.getByRole("button", { name: "Manage" }).click();
  await page.getByRole("button", { name: "Transition to Leader" }).click();
  const transitionDialog = page.getByRole("dialog", { name: "Transition member to Leader" });
  await expect(transitionDialog).toBeVisible();
  const endMembershipCheckbox = transitionDialog.getByRole("checkbox", { name: "End this member's current youth membership after leader approval" });
  await endMembershipCheckbox.setChecked(endMembership);
  await transitionDialog.getByRole("button", { name: "Prepare registration link" }).click();
  const link = await transitionDialog.getByLabel("Leader registration link").inputValue();
  fixture.invitationId = new URL(link).searchParams.get("transition") || undefined;

  const whatsapp = transitionDialog.getByRole("link", { name: "WhatsApp registration link" });
  await expect(whatsapp).toBeVisible();
  const whatsappUrl = new URL(await whatsapp.getAttribute("href")!);
  expect(whatsappUrl.hostname).toBe("wa.me");
  expect(whatsappUrl.searchParams.get("text")).toContain(link);
  expect(whatsappUrl.searchParams.get("text")).toContain("continue your Scout leader registration and onboarding");
  expect(whatsappUrl.searchParams.get("text")).not.toContain(firstName);
  await expect(transitionDialog).toContainText(`Email recipient: ${email}`);

  let emailAttempts = 0;
  const emailRequests: { invitationId: string }[] = [];
  await page.route("**/leader-transition-link", async (route) => {
    emailAttempts += 1;
    emailRequests.push(route.request().postDataJSON() as { invitationId: string });
    if (emailAttempts === 1) await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, error: "Unable to complete the requested communication action.", reference: "ERR-0123456789AB" }) });
    else await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await transitionDialog.getByRole("button", { name: "Copy registration link" }).click();
  await expect(transitionDialog.getByRole("alert").filter({ hasText: "Registration link copied." })).toBeVisible();
  expect(await page.evaluate(() => (window as Window & { __transitionCopied?: string }).__transitionCopied)).toBe(link);
  await transitionDialog.getByRole("button", { name: "Email registration link" }).click();
  const failedEmailAlert = transitionDialog.getByRole("alert").filter({ hasText: "Email could not be sent." });
  await expect(failedEmailAlert).toBeVisible();
  await expect(failedEmailAlert).not.toContainText(fixture.invitationId!);
  await transitionDialog.getByRole("button", { name: "Email registration link" }).click();
  await expect(transitionDialog.getByRole("alert").filter({ hasText: `Registration link sent to ${email}.` })).toBeVisible();
  await transitionDialog.getByRole("button", { name: "Email registration link" }).click();
  await expect(transitionDialog.getByRole("alert").filter({ hasText: `Registration link sent to ${email}.` })).toBeVisible();
  expect(emailRequests).toEqual([{ invitationId: fixture.invitationId }, { invitationId: fixture.invitationId }, { invitationId: fixture.invitationId }]);
  const transitionDb = getFirestore(fixtureApp());
  expect((await transitionDb.collection("leaderTransitionInvitations").where("memberId", "==", memberId).get()).size).toBe(1);
  expect((await transitionDb.collection("members").where("emailAddress", "==", email).get()).size).toBe(1);

  await transitionDialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("link", { name: "Back to Member Management" }).click();
  await page.getByRole("button", { name: /^Menu ·|Open Leader Menu/ }).click();
  await page.getByRole("button", { name: "Sign Out", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/login$/);
  await expect(page.getByRole("button", { name: "Sign In", exact: true })).toBeVisible();
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Leader Registration" })).toBeVisible();
  await page.getByRole("textbox", { name: "Password", exact: true }).fill(passwordForMember);
  await page.getByRole("textbox", { name: "Confirm password", exact: true }).fill(passwordForMember);
  await page.getByRole("combobox", { name: "Requested role" }).click();
  await page.getByRole("option", { name: "Scouter", exact: true }).click();
  await page.getByLabel(/I confirm that the information supplied is accurate/).check();
  await page.getByRole("button", { name: "Submit Leader Registration" }).click();
  await expect(page.getByText("Your leader registration has been sent to the group administrator.")).toBeVisible();

  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill("test.webadmin@example.com");
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
  await page.goto("/leader/requests");
  await page.getByRole("button", { name: `Review leader request for ${firstName} ${lastName}` }).click();
  const reviewDialog = page.getByRole("dialog", { name: "Review leader request" });
  await expect(reviewDialog).toContainText("This request started from an existing member record.");
  await reviewDialog.getByRole("button", { name: /Approve as Leader|Approve & Merge Access/ }).click();
  const approvalDialog = page.getByRole("dialog", { name: /Approve (?:leader access|and merge Leader access)\?/ });
  await approvalDialog.getByRole("button", { name: /Confirm Approval/ }).click();
  await expect(page.getByText(`${firstName} ${lastName} has been approved as a Leader`)).toBeVisible();

  // The success alert is rendered before finish() completes its audit write,
  // closes the approval dialog and refreshes the request list. Navigating on
  // the alert alone races that still-running lifecycle and can abort page.goto.
  // Wait for the authoritative post-approval UI state instead.
  await expect(approvalDialog).toBeHidden();
  const approvedRequest = page.getByRole("link", { name: `Open Leader Access for ${firstName} ${lastName}` });
  await expect(approvedRequest).toBeVisible();

  await page.goto(`/leader/members?status=all&q=${encodeURIComponent(lastName)}`);
  const updatedMember = page.locator(`[data-testid^="member-card-"][data-member-last-name="${lastName}"]`);
  await expect(updatedMember).toBeVisible();
  await expect(updatedMember).toContainText(endMembership ? "Left" : "Active");
  await expect(updatedMember).toContainText(section);
  if (existingAccount) {
    const db = getFirestore(getApps()[0]);
    const persisted = (await db.collection("members").doc(memberId).get()).data()!;
    expect(persisted.accountUid).toBe(existingUid);
    for (const field of ["familyId", "sections", "sectionRoles", "dateOfBirth", "emailAddress", "parentName"]) expect(persisted[field]).toEqual(original![field]);
    const parentAccount = (await db.collection("parentAccounts").doc(existingUid).get()).data()!;
    expect(parentAccount.status).toBe("approved");
    expect(parentAccount.memberIds).toEqual(["TEST_member_beaver_01"]);
    expect((await db.collection("leaderRegistrationRequests").doc(existingUid).get()).data()!.status).toBe("approved");
    expect((await db.collection("members").where("emailAddress", "==", email).get()).size).toBe(1);
  }
  await page.goto(link);
  await expect(page.getByText("This leader registration link is unavailable or has expired.")).toBeVisible();
}

test("approved transition ends youth membership and prevents reusing the link", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Transition approval covers desktop and mobile Chromium.");
  await completeTransition(page, "Cubs", true);
});

test("approved Rover transition preserves concurrent Rover membership", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Transition approval covers desktop and mobile Chromium.");
  await completeTransition(page, "Rovers", false);
});

test("transition reuses an existing Parent login and preserves family, multi-section and youth-role identity", async ({ page }) => {
  await completeTransition(page, "Cubs", false, true);
});
