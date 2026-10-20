import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
import { mkdir } from "node:fs/promises";
const password = process.env.E2E_TEST_USER_PASSWORD;
const pdf = Buffer.from("%PDF-1.4\nMaintenance bill\n%%EOF");
async function enable() {
  const setting = scheduleFixtureDb().doc("siteSettings/maintenanceExperience");
  const previous = await setting.get(); await setting.set({version: "redesigned"});
  return async () => { if (previous.exists) await setting.set(previous.data()!); else await setting.delete(); };
}
async function evidence(page: import("@playwright/test").Page, name: string, project: string) {
  if (!process.env.MAINTENANCE_SCREENSHOTS) return;
  await mkdir(process.env.MAINTENANCE_SCREENSHOTS, {recursive: true});
  await page.evaluate(() => window.scrollTo({top: 0, left: 0, behavior: "instant"}));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.screenshot({animations: "disabled", path: `${process.env.MAINTENANCE_SCREENSHOTS}/${name}-${project}.png`, fullPage: true});
}
test("members upload, reload and download maintenance documents", async ({page}, info) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const restore = await enable(); const db = scheduleFixtureDb();
  try {
    await loginAsLeader(page, {email: process.env.E2E_LEADER_EMAIL || "test.scout.programme.scouter@example.com", password: password!});
    await page.goto("/maintenance/documents");
    const name = `Maintenance roof bill ${info.project.name}.pdf`;
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", {name: "Upload document", exact: true}).focus();
    await page.keyboard.press("Enter");
    await (await chooser).setFiles({name, mimeType: "application/pdf", buffer: pdf});
    await expect(page.getByText("Document uploaded successfully.", {exact: true})).toBeVisible();
    await page.reload();
    const card = page.locator(".MuiPaper-root").filter({has: page.getByText(name, {exact: true})}).last();
    await expect(card).toBeVisible();
    const received = page.waitForEvent("download"); await card.getByRole("button", {name: "Download", exact: true}).click();
    expect((await received).suggestedFilename()).toBe(name);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await evidence(page, "documents", info.project.name);
  } finally {
    for (const doc of (await db.collection("maintenance/group/documents").get()).docs) if (doc.data().fileName?.includes(info.project.name)) await doc.ref.delete();
    await restore();
  }
});
test("tasks persist without documents, default responsibility and completion", async ({page}, info) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const restore = await enable(); const db = scheduleFixtureDb();
  let taskId = "";
  try {
    await loginAsLeader(page, {email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password!});
    await page.goto("/maintenance/tasks");
    await page.getByRole("link", {name: "Raise a task", exact: true}).click();
    const description = `Repair the roof ${info.project.name}. Please inspect the den roof and replace the damaged flashing before the next section meeting.`;
    await page.getByLabel("Task description").fill(description);
    await expect(page.getByLabel("Responsible leader")).toBeEnabled();
    await page.getByRole("button", {name: "Save task", exact: true}).click();
    await expect(page.getByText("Task saved successfully.", {exact: true})).toBeVisible();
    taskId = new URL(page.url()).pathname.split("/")[3];
    await expect(page.getByText("Responsible leader:", {exact: false})).not.toContainText("Assignment pending");
    await page.reload();
    await expect(page.getByText(description, {exact: true})).toBeVisible();
    await page.getByRole("button", {name: "Mark complete", exact: true}).click();
    await expect(page.getByText("Task updated successfully.", {exact: true})).toBeVisible();
    await page.reload();
    await expect(page.getByRole("button", {name: "Reopen task", exact: true})).toBeVisible();
    await expect(page.getByLabel("Responsible leader", {exact: true})).toBeEnabled();
    await evidence(page, "task-details", info.project.name);
    await page.getByRole("link", {name: "Back to Tasks", exact: true}).click();
    await expect(page.getByRole("link", {name: "View task", exact: true}).first()).toBeVisible();
    await expect(page.getByText(description, {exact: true})).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await evidence(page, "tasks", info.project.name);
  } finally { if (taskId) await db.doc(`maintenance/group/tasks/${taskId}`).delete(); await restore(); }
});
test("approved parent links a retained document and explicitly assigns a task", async ({page}, info) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const restore = await enable(); const db = scheduleFixtureDb(); let taskId = "";
  const name = `Parent roof support ${info.project.name}.pdf`;
  try {
    await page.goto("/parent");
    await page.getByLabel("Email", {exact: true}).fill(process.env.E2E_PARENT_EMAIL || "test.beaver.parent1@example.com");
    await page.getByLabel("Password", {exact: true}).fill(password!);
    await page.getByRole("button", {name: "Sign In", exact: true}).click();
    await expect(page.getByRole("button", {name: "Sign In", exact: true})).toBeHidden();
    await page.goto("/maintenance/documents");
    await page.getByLabel("Upload document").setInputFiles({name, mimeType: "application/pdf", buffer: pdf});
    await expect(page.getByText("Document uploaded successfully.", {exact: true})).toBeVisible();
    await page.getByRole("navigation", {name: "Maintenance", exact: true}).getByRole("link", {name: "Tasks", exact: true}).click();
    await page.getByRole("link", {name: "Raise a task", exact: true}).click();
    await page.getByLabel("Task description").fill(`Review parent maintenance report ${info.project.name}`);
    await page.getByRole("checkbox", {name, exact: true}).check();
    const leader = (await db.doc("organisationLeadership/TEST_uid_scout_section_leader").get()).data()!;
    await page.getByLabel("Responsible leader", {exact: true}).click();
    await page.getByRole("option", {name: leader.displayName, exact: true}).click();
    await page.getByRole("button", {name: "Save task", exact: true}).click();
    await expect(page.getByText("Task saved successfully.", {exact: true})).toBeVisible();
    taskId = new URL(page.url()).pathname.split("/")[3];
    await page.reload();
    await expect(page.getByText(`Responsible leader: ${leader.displayName}`, {exact: true})).toBeVisible();
    await expect(page.getByRole("button", {name, exact: true})).toBeVisible();
    expect((await db.doc(`maintenance/group/tasks/${taskId}`).get()).data()?.documentIds).toHaveLength(1);
    await expect(page.getByRole("link", {name: "Back to Parent Portal", exact: true})).toBeVisible();
  } finally {
    if (taskId) await db.doc(`maintenance/group/tasks/${taskId}`).delete();
    for (const doc of (await db.collection("maintenance/group/documents").get()).docs) if (doc.data().fileName === name) await doc.ref.delete();
    await restore();
  }
});
