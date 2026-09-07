import { expect, test } from "@playwright/test";

const leaderEmail = process.env.E2E_LEADER_EMAIL;
const leaderPassword = process.env.E2E_LEADER_PASSWORD;

async function signInAndOpenInfo(page: import("@playwright/test").Page) {
  await page.goto("/leader/login");
  await page.getByLabel(/email/i).fill(leaderEmail!);
  await page.getByLabel(/password/i).fill(leaderPassword!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/leader/);
  await page.goto("/leader/info");
}

test.describe("Leader portal information", () => {
  test.skip(!leaderEmail || !leaderPassword, "Leader E2E credentials are required.");

  test("describes current operational capabilities without historical stage framing", async ({ page }) => {
    await signInAndOpenInfo(page);

    await expect(page.getByRole("heading", { name: "Leader Portal Information" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Current Capabilities" })).toBeVisible();
    await expect(page.getByText("Members, parents and roles", { exact: true })).toBeVisible();
    await expect(page.getByText("Weekly meetings and programme", { exact: true })).toBeVisible();
    await expect(page.getByText("Adventure Skills and Badgework", { exact: true })).toBeVisible();
    await expect(page.getByText("Equipment and stores", { exact: true })).toBeVisible();
    await expect(page.getByText("Section floats and receipts", { exact: true })).toBeVisible();
    await expect(page.getByText("Event galleries", { exact: true })).toBeVisible();
    await expect(page.getByText(/Stages 1[–-]/)).toHaveCount(0);

    await page.getByText("How does Parent Portal access work?", { exact: true }).click();
    await expect(page.getByText(/approved and linked to the correct children/i)).toBeVisible();

    await page.getByText("Can I copy a Weekly Meeting?", { exact: true }).click();
    await expect(page.getByText(/creates a new meeting rather than overwriting the original/i)).toBeVisible();

    await page.getByText("How does Adventure Skills progress work?", { exact: true }).click();
    await expect(page.getByText(/Progress belongs to the member/i)).toBeVisible();

    await page.getByText("How do receipts work?", { exact: true }).click();
    await expect(page.getByText(/Where storage-backed attachments are available/i)).toBeVisible();
  });

  test("keeps current Info and FAQ usable on a phone viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAndOpenInfo(page);

    await expect(page.getByRole("heading", { name: "Current Capabilities" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Frequently Asked Questions" })).toBeVisible();

    await page.getByText("How does the Leader Menu work on mobile?", { exact: true }).click();
    await expect(page.getByText(/smaller screens the menu uses compact disclosure panels/i)).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
