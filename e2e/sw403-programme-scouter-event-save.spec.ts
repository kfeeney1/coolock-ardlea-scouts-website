import { expect, test } from "@playwright/test";

const password = process.env.E2E_TEST_USER_PASSWORD;
const scouterEmail = process.env.E2E_LEADER_EMAIL || "test.scout.programme.scouter@example.com";

test("SW-403 Programme Scouter saves and reopens an assigned-section event on desktop and mobile", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Event save runs on desktop Chromium and Pixel 7 Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");

  await page.goto("/leader/login");
  await page.getByLabel("Email address").fill(scouterEmail);
  await page.getByLabel("Password").fill(password!);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("heading", { name: "Leader Dashboard" })).toBeVisible();

  const createRequestIds: string[] = [];
  const updateRequestIds: string[] = [];
  let failNextSave = false;
  page.on("request", (request) => {
    if (!new URL(request.url()).pathname.endsWith("/event-audience-save")) return;
    const body = request.postDataJSON() as { operation?: string; eventId?: string };
    if (body.operation === "create" && body.eventId) createRequestIds.push(body.eventId);
    if (body.operation === "update" && body.eventId) updateRequestIds.push(body.eventId);
  });
  await page.route("**/event-audience-save", async (route) => {
    if (failNextSave) {
      failNextSave = false;
      await route.abort("failed");
      return;
    }
    await route.continue();
  });

  await page.goto("/leader/events/create");
  await expect(page.getByTestId("event-create-page")).toBeVisible();
  const title = `TEST SW-403 Programme Scouter ${Date.now()}`;
  await page.getByLabel("Event title").fill(title);
  await page.getByRole("combobox", { name: "Section" }).click();
  await page.getByRole("option", { name: "Scouts", exact: true }).click();
  await page.getByLabel("Start date").fill("2099-07-10");
  failNextSave = true;
  await page.getByRole("button", { name: "Create Event", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Unable to save the event. Your edits are still here." })).toBeVisible();
  await expect(page).toHaveURL(/\/leader\/events\/create$/);
  await expect(page.getByLabel("Event title")).toHaveValue(title);
  await expect(page.getByLabel("Start date")).toHaveValue("2099-07-10");
  await expect(page.getByRole("alert").filter({ hasText: /saved successfully|event created/i })).toHaveCount(0);

  await page.getByRole("button", { name: "Create Event", exact: true }).click();

  await expect(page).toHaveURL(/\/leader\/events\/(?!create(?:$|\/))[^/]+$/);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const eventId = new URL(page.url()).pathname.split("/").at(-1)!;
  expect(createRequestIds).toEqual([eventId, eventId]);
  await page.goto("/leader/events");
  await page.goto(`/leader/events/${encodeURIComponent(eventId)}`);
  await expect(page.getByRole("heading", { name: title })).toBeVisible();

  await page.getByRole("link", { name: "Edit Event", exact: true }).click();
  const editedTitle = `${title} edited`;
  const editUrl = page.url();
  await page.getByLabel("Event title").fill(editedTitle);
  failNextSave = true;
  await page.getByRole("button", { name: "Save Event", exact: true }).click();
  await expect(page).toHaveURL(editUrl);
  await expect(page.getByRole("alert").filter({ hasText: "Unable to save this event. Your edits are still here." })).toBeVisible();
  await expect(page.getByLabel("Event title")).toHaveValue(editedTitle);
  await expect(page.getByRole("status").filter({ hasText: "Save failed — your edits are still here." })).toBeVisible();

  await page.getByRole("button", { name: "Save Event", exact: true }).click();
  await expect(page).toHaveURL(/\/leader\/events$/);
  expect(updateRequestIds).toEqual([eventId, eventId]);
  await page.goto(`/leader/events/${encodeURIComponent(eventId)}`);
  await expect(page.getByRole("heading", { name: editedTitle })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: editedTitle })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: /Unable to save|not authorised/i })).toHaveCount(0);
});
