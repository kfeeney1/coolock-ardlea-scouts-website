import { randomUUID } from "node:crypto";
import { getApps } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getStorage as getAdminStorage } from "firebase-admin/storage";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore, terminate } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { maintenanceDocumentStore, documentPath } from "../src/services/maintenanceDocumentStore";
import { maintenanceTaskStore } from "../src/services/maintenanceTaskStore";
import { enableMaintenanceFixture } from "./support/maintenance-fixtures";
import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
const password = process.env.E2E_TEST_USER_PASSWORD;
for (const navigationVersion of ["existing", "redesigned"] as const) test(`Maintenance rollout, visible navigation, refresh and Back (${navigationVersion})`, async ({ page }, testInfo) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const setting = scheduleFixtureDb().doc("siteSettings/maintenanceExperience");
  const before = await setting.get();
  const navigationSetting = scheduleFixtureDb().doc("siteSettings/leaderNavigation");
  const previousNavigation = await navigationSetting.get();
  try {
    await navigationSetting.set({version: navigationVersion});
    await setting.delete();
    await page.goto("/maintenance/tasks");
    await expect(page.getByText("Sign in to access Maintenance.", { exact: true })).toBeVisible();
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto("/maintenance/tasks");
    await expect(page.getByText("Maintenance is currently disabled.", { exact: true })).toBeVisible();
    // A legacy enabled value must remain disabled until a deliberate SDK rollout.
    await setting.set({version: "redesigned"});
    await page.reload();
    await expect(page.getByText("Maintenance is currently disabled.", { exact: true })).toBeVisible();
    await page.goto("/leader/settings");
    const toggle = page.getByRole("switch", { name: "Maintenance", exact: true });
    await expect(toggle).toBeEnabled();
    await expect(toggle).not.toBeChecked();
    await toggle.click();
    await expect(page.getByRole("status").filter({ hasText: "Maintenance setting saved." })).toBeVisible();
    await expect(toggle).toBeChecked();
    expect((await setting.get()).data()?.sdkRevision).toBe(1);
    await page.reload();
    await expect(toggle).toBeChecked();
    await page.locator('button[aria-controls="leader-navigation"]').click();
    const navigation = page.getByRole("navigation", {name: "Leader navigation", exact: true});
    await expect(navigation).toBeVisible();
    const group = navigation.getByRole("button", {name: /^Group Operations/}).filter({visible: true}).first();
    if (testInfo.project.name === "mobile-chromium" || navigationVersion === "redesigned") {
      await expect(group).toBeVisible();
      if (await group.getAttribute("aria-expanded") !== "true") await group.click();
    }
    await page.getByRole("link", { name: "Maintenance", exact: true }).filter({ visible: true }).first().click();
    await expect(page.getByRole("heading", { name: "Maintenance", exact: true })).toBeVisible();
    await page.getByRole("navigation", { name: "Maintenance", exact: true }).getByRole("link", { name: "Documents", exact: true }).click();
    await expect(page).toHaveURL(/\/maintenance\/documents$/);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Documents", exact: true })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/\/maintenance\/tasks$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole("link", { name: "Back to Dashboard", exact: true }).click();
    await page.goto("/leader/settings");
    await expect(toggle).toBeChecked();
    await toggle.click();
    await expect(page.getByRole("status").filter({ hasText: "Maintenance setting saved." })).toBeVisible();
    await expect(toggle).not.toBeChecked();
    expect((await setting.get()).data()).toMatchObject({ version: "existing", sdkRevision: 1 });
    await page.reload();
    await expect(toggle).not.toBeChecked();
    await page.goto("/maintenance/documents");
    await expect(page.getByText("Maintenance is currently disabled.", { exact: true })).toBeVisible();
  } finally {
    if (before.exists) await setting.set(before.data()!); else await setting.delete();
    if (previousNavigation.exists) await navigationSetting.set(previousNavigation.data()!); else await navigationSetting.delete();
  }
});

test("signed-in outsider cannot read or change enabled Maintenance tasks or documents", async ({ page }) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const fixtureDb = scheduleFixtureDb();
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST !== "127.0.0.1:9099" || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== "127.0.0.1:9199") {
    throw new Error("Maintenance access fixtures require local demo Auth and Storage emulators.");
  }
  const projectId = fixtureDb.projectId;
  const storageBucket = `${projectId}.appspot.com`;
  const adminApp = getApps().find(app => app.name === "schedule-fixtures")!;
  const adminAuth = getAdminAuth(adminApp);
  const id = randomUUID();
  const email = `maintenance-outsider-${id}@example.com`;
  const task = fixtureDb.doc(`maintenance/group/tasks/${id}`);
  const document = fixtureDb.doc(`maintenance/group/documents/${id}`);
  const object = getAdminStorage(adminApp).bucket(storageBucket).file(documentPath(id));
  const restore = await enableMaintenanceFixture();
  const client = initializeApp({ apiKey: "demo-api-key", projectId, storageBucket }, id);
  const auth = getAuth(client);
  const db = getFirestore(client);
  const storage = getStorage(client);
  let outsiderUid: string | undefined;
  try {
    outsiderUid = (await adminAuth.createUser({ email, password: password! })).uid;
    await page.goto("/parent");
    await page.getByLabel("Email", { exact: true }).fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password!);
    await page.getByRole("button", { name: "Sign In", exact: true }).click();
    await expect(page.getByRole("button", { name: "Submit Parent Registration", exact: true })).toBeVisible();

    for (const path of ["/maintenance/tasks", "/maintenance/tasks/new", "/maintenance/documents"]) {
      await page.goto(path);
      await expect(page.getByRole("alert")).toHaveText("Maintenance is restricted to approved group members.");
      await expect(page.getByRole("navigation", { name: "Maintenance", exact: true })).toHaveCount(0);
    }

    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    await signInWithEmailAndPassword(auth, email, password!);
    const uid = () => auth.currentUser?.uid;
    const tasks = maintenanceTaskStore(db, uid);
    const documents = maintenanceDocumentStore(db, storage, uid);
    const denied = { code: "permission-denied" };
    await expect(tasks({ action: "list" })).rejects.toMatchObject(denied);
    await expect(documents.list()).rejects.toMatchObject(denied);
    await expect(tasks({ action: "create", id, description: "Outsider task", documentIds: [] })).rejects.toMatchObject(denied);
    const pdf = new File(["%PDF-1.4\nSynthetic maintenance document\n%%EOF"], "outsider.pdf", { type: "application/pdf" });
    await expect(documents.upload(pdf, id)).rejects.toMatchObject(denied);

    expect((await task.get()).exists).toBe(false);
    expect((await document.get()).exists).toBe(false);
    expect((await object.exists())[0]).toBe(false);
  } finally {
    await Promise.all([
      task.delete(),
      document.delete(),
      object.delete({ ignoreNotFound: true }),
      outsiderUid ? adminAuth.deleteUser(outsiderUid) : Promise.resolve(),
      restore(),
      terminate(db).finally(() => deleteApp(client)),
    ]);
  }
});
