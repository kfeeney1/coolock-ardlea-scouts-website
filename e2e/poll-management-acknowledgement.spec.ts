import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;

test("confirmed poll publish and close remain usable while follow-up reads are pending", async ({ page }, testInfo) => {
  test.skip(!password, "Configure canonical E2E credentials.");
  await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
  await page.goto("/leader/polls");
  const panel = page.getByTestId("leader-polls");
  const question = `Poll acknowledgement ${Date.now()} ${testInfo.project.name}`;
  await page.getByLabel("Poll question").fill(question);
  await page.getByLabel("Answer options").fill("Hike\nCamp");
  await page.getByRole("combobox", { name: "Poll scope" }).click();
  await page.getByRole("option", { name: "Whole group", exact: true }).click();
  await expect(page.getByRole("listbox")).toBeHidden();
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  const card = page.getByTestId(/^leader-poll-manager-/).filter({ hasText: question });
  await expect(card).toContainText("draft");
  await expect(card.getByRole("button", { name: "Publish poll", exact: true })).toBeEnabled();

  let releaseReads!: () => void;
  let readsHeld = false;
  const readGate = new Promise<void>((resolve) => { releaseReads = resolve; });
  const listenChannel = "**/google.firestore.v1.Firestore/Listen/channel?**";
  await page.route(listenChannel, async (route) => {
    const messages = new URLSearchParams(route.request().postData() || "");
    const readsPollIndexes = [...messages.values()].some((value) => value.includes('"addTarget"') && value.includes('"collectionId":"audienceSections"'));
    if (readsPollIndexes) { readsHeld = true; await readGate; }
    await route.continue();
  });
  try {
    await card.getByRole("button", { name: "Publish poll", exact: true }).click();
    await expect.poll(() => readsHeld).toBe(true);
    await expect(panel.getByRole("status").filter({ hasText: "Poll published." })).toBeVisible();
    await expect(card).toContainText("published");
    await expect(card.getByRole("button", { name: "Publish poll", exact: true })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Close poll", exact: true })).toBeEnabled();
    // A second confirmed transition must not wait for, or be rolled back by,
    // the first transition's still-pending refresh. All writes remain real.
    await card.getByRole("button", { name: "Close poll", exact: true }).click();
    await expect(panel.getByRole("status").filter({ hasText: "Poll closed." })).toBeVisible();
    await expect(card).toContainText("closed");
    await expect(card.getByRole("button", { name: "View results", exact: true })).toBeEnabled();
  } finally { releaseReads(); }
  await expect(panel.getByText("Loading active polls…", { exact: true })).toHaveCount(0);
  await expect(card).toContainText("closed");
  await page.unroute(listenChannel);
  await page.reload();
  await expect(card).toContainText("closed");
  await expect(card.getByRole("button", { name: "Close poll", exact: true })).toHaveCount(0);
});
