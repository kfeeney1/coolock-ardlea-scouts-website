import { expect, test } from "@playwright/test";

test("equipment management actions wait for the initial inventory before opening dialogs", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_TEST_USER_PASSWORD;
  test.skip(!email || !password, "Configure canonical E2E admin credentials.");
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(email!);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard", exact: true })).toBeVisible();

  let release!: () => void;
  let held = false;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/google.firestore.v1.Firestore/Listen/channel?**", async (route) => {
    const payload = new URLSearchParams(route.request().postData() || "");
    if ([...payload.values()].some((value) => value.includes("equipmentItems"))) {
      held = true;
      await gate;
    }
    await route.continue();
  });
  try {
    await page.goto("/leader/equipment");
    await expect.poll(() => held).toBe(true);
    await expect(page.getByText("Loading equipment…", { exact: true })).toBeVisible();
    for (const name of ["Add equipment", "Manage Stores", "Manage categories"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
    }
    release();
    await expect(page.getByText("Loading equipment…", { exact: true })).toHaveCount(0);
    for (const name of ["Add equipment", "Manage Stores", "Manage categories"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeEnabled();
    }
    await page.getByRole("button", { name: "Add equipment", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add equipment", exact: true });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Equipment name").fill("TEST Initial load draft");
    await expect(dialog.getByLabel("Equipment name")).toHaveValue("TEST Initial load draft");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/leader\/equipment$/);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});
