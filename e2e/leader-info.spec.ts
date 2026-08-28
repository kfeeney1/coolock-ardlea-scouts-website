import { expect, test } from "@playwright/test";

const leaderEmail = process.env.E2E_LEADER_EMAIL;
const leaderPassword = process.env.E2E_LEADER_PASSWORD;

test.describe("Leader portal information", () => {
  test.skip(!leaderEmail || !leaderPassword, "Leader E2E credentials are required.");

  test.beforeEach(async ({ page }) => {
    await page.goto("/leader/login");
    await page.getByLabel(/email/i).fill(leaderEmail!);
    await page.getByLabel(/password/i).fill(leaderPassword!);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/leader/);
    await page.goto("/leader/info");
  });

  test("documents current weekly meeting, equipment and permission workflows", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Leader Portal Information" })).toBeVisible();
    await expect(page.getByText("Weekly Meetings", { exact: true })).toBeVisible();
    await expect(page.getByText("Production Hardening & Continuous Improvement", { exact: true })).toBeVisible();
    await expect(page.getByText("Equipment & Stores", { exact: true })).toBeVisible();
    await expect(page.getByText(/Stages 1–13 are complete/)).toBeVisible();

    await page.getByText("Can I copy a meeting for next week?", { exact: true }).click();
    await expect(page.getByText(/creates a new open meeting; it never overwrites the original/i)).toBeVisible();
    await expect(page.getByText(/equipment reservations and checkout transactions are reset/i)).toBeVisible();

    await page.getByText("Who can manage equipment?", { exact: true }).click();
    await expect(page.getByText(/Group Quartermaster \/ Bo’sun, Group Leader and administrator roles/i)).toBeVisible();
    await expect(page.getByText(/Parents have no access to internal equipment stock/i)).toBeVisible();

    await page.getByText("What equipment reports are available?", { exact: true }).click();
    await expect(page.getByText(/Export all equipment CSV button/i)).toBeVisible();

    await page.getByText("Who can see or edit weekly meetings?", { exact: true }).click();
    await expect(page.getByText(/Group Secretary has all-section weekly meeting history access/i)).toBeVisible();

    await page.getByText("Where is Sign Out?", { exact: true }).click();
    await expect(page.getByText(/final action in the expandable Leader Menu/i)).toBeVisible();
  });
});
