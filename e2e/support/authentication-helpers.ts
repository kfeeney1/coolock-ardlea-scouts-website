import { expect, type Page } from "@playwright/test";

export type LeaderCredentials = Readonly<{ email: string; password: string }>;

export async function loginAsLeader(page: Page, credentials: LeaderCredentials): Promise<void> {
  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(credentials.email);
  await page.getByLabel("Password").fill(credentials.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();
}
