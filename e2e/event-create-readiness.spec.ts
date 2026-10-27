import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";
const password = process.env.E2E_TEST_USER_PASSWORD;

test("Create Event readiness does not hydrate unrelated event audiences", async ({ page }) => {
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: process.env.E2E_ADMIN_EMAIL || "test.webadmin@example.com", password: password! });
  const unrelatedReads: string[] = [];
  page.on("request", request => {
    if (!new URL(request.url()).pathname.endsWith("/Listen/channel")) return;
    if (new URL(request.frame().url()).pathname !== "/leader/events/create") return;
    for (const [key, value] of new URLSearchParams(request.postData() ?? "")) {
      if (!key.endsWith("___data__")) continue;
      const query = JSON.parse(value).addTarget?.query;
      for (const item of query?.structuredQuery?.from ?? []) {
        if (["events", "audienceMembers"].includes(item.collectionId)) unrelatedReads.push(item.collectionId);
      }
    }
  });
  await page.goto("/leader/events/create");
  await page.getByLabel("Event title").fill("TEST bounded event creation readiness");
  await page.getByRole("textbox", { name: /^Start date/ }).fill("2099-05-10");
  await expect(page.getByText(/^Audience: [1-9]\d* members/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Event", exact: true })).toBeEnabled();
  expect(unrelatedReads).toEqual([]);
});
