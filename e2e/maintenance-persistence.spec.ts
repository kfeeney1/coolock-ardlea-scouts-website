import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { loginAsLeader } from "./support/authentication-helpers";
import { scheduleFixtureDb } from "./support/schedule-fixtures";
const password = process.env.E2E_TEST_USER_PASSWORD;
const pdf = Buffer.from("%PDF-1.4\nMaintenance synthetic bill\n%%EOF");
async function enabled() {
  const setting = scheduleFixtureDb().doc("siteSettings/maintenanceExperience");
  const previous = await setting.get(); await setting.set({version: "redesigned"});
  return async () => {if (previous.exists) await setting.set(previous.data()!); else await setting.delete();};
}
async function createTask(page: Page, description: string, documentName?: string) {
  await page.getByRole("link", {name: "Raise a task", exact: true}).click();
  await page.getByLabel("Task description").fill(description);
  if (documentName) await page.getByRole("checkbox", {name: documentName, exact: true}).check();
  await page.getByRole("button", {name: "Save task", exact: true}).click();
  await expect(page.getByText("Task saved successfully.", {exact: true})).toBeVisible();
  return new URL(page.url()).pathname.split("/")[3];
}
test("leader creates an independent task and retains its details through reload and real Back controls", async ({page}, info) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const restore = await enabled(); const ids: string[] = [];
  try {
    await loginAsLeader(page, {email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password!});
    await page.goto("/maintenance/tasks");
    const description = `Independent task ${info.project.name}: ${"Inspect the roof and supporting timbers. ".repeat(10)}`;
    ids.push(await createTask(page, description));
    await expect(page.getByText("No linked documents.", {exact: true})).toBeVisible();
    await page.reload();
    await expect(page.getByText(description.trim(), {exact: true})).toBeVisible();
    await page.getByRole("link", {name: "Back to Tasks", exact: true}).click();
    await expect(page).toHaveURL(/\/maintenance\/tasks$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/maintenance/tasks/${ids[0]}$`));
    await expect(page.getByText(description.trim(), {exact: true})).toBeVisible();
  } finally {for (const id of ids) await scheduleFixtureDb().doc(`maintenance/group/tasks/${id}`).delete(); await restore();}
});
test("approved parent uploads and downloads a retained bill and links it to multiple persisted tasks", async ({page}, info) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  const restore = await enabled(); const ids: string[] = [];
  const name = `Parent maintenance ${info.project.name}.pdf`;
  try {
    await page.goto("/parent");
    await page.getByLabel("Email", {exact: true}).fill(process.env.E2E_PARENT_EMAIL || "test.beaver.parent1@example.com");
    await page.getByLabel("Password", {exact: true}).fill(password!);
    await page.getByRole("button", {name: "Sign In", exact: true}).click();
    if (info.project.name === "mobile-chromium") {
      await page.getByRole("button", {name: "Open navigation menu", exact: true}).click();
      await page.getByRole("menuitem", {name: "Maintenance", exact: true}).click();
    } else {
      await page.getByRole("link", {name: "Maintenance", exact: true}).click();
    }
    await expect(page.getByRole("heading", {name: "Maintenance", exact: true})).toBeVisible();
    const maintenance = page.getByRole("navigation", {name: "Maintenance", exact: true});
    await maintenance.getByRole("link", {name: "Documents", exact: true}).click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", {name: "Upload document", exact: true}).focus(); await page.keyboard.press("Enter");
    await (await chooser).setFiles({name, mimeType: "application/pdf", buffer: pdf});
    await expect(page.getByText("Document uploaded successfully.", {exact: true})).toBeVisible();
    await page.reload();
    const card = page.locator(".MuiPaper-root").filter({has: page.getByText(name, {exact: true})}).last();
    await expect(card).toBeVisible();
    const received = page.waitForEvent("download"); await card.getByRole("button", {name: "Download", exact: true}).click();
    const download = await received; expect(download.suggestedFilename()).toBe(name);
    expect(await readFile((await download.path())!)).toEqual(pdf);
    await maintenance.getByRole("link", {name: "Tasks", exact: true}).click();
    for (const description of [`Repair cooker ${info.project.name}`, `Review cooker bill ${info.project.name}`]) {
      ids.push(await createTask(page, description, name));
      await page.reload();
      await expect(page.getByText(description, {exact: true})).toBeVisible();
      await expect(page.getByRole("button", {name, exact: true})).toBeVisible();
      await page.getByRole("link", {name: "Back to Tasks", exact: true}).click();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    const db = scheduleFixtureDb();
    for (const id of ids) await db.doc(`maintenance/group/tasks/${id}`).delete();
    const app = getApps().find(item => item.name === "schedule-fixtures")!;
    for (const item of (await db.collection("maintenance/group/documents").where("fileName", "==", name).get()).docs) {
      await getStorage(app).bucket("demo-coolock-ardlea-scouts.appspot.com").file(`maintenance-documents/${item.id}`).delete({ignoreNotFound: true});
      await item.ref.delete();
    }
    await restore();
  }
});
