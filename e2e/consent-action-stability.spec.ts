import { expect, test } from "@playwright/test";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;

test("consent Back stays under the pointer when the record finishes loading", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Consent action stability runs on desktop and mobile Chromium.");
  test.skip(!password, "Configure E2E_TEST_USER_PASSWORD.");
  await loginAsLeader(page, { email: "test.webadmin@example.com", password: password! });
  await page.goto("/leader/members/TEST_member_cub_01");
  const consentId = "TEST_flow_consent_youth_clear";
  const consentLink = page.getByTestId(`open-consent-medical-${consentId}`);
  await expect(consentLink).toBeVisible();

  let releaseRead!: () => void;
  let readHeld = false;
  const readGate = new Promise<void>((resolve) => { releaseRead = resolve; });
  const listenChannel = "**/google.firestore.v1.Firestore/Listen/channel?**";
  await page.route(listenChannel, async (route) => {
    const values = new URLSearchParams(route.request().postData() || "");
    const readsConsent = [...values.values()].some((value) => value.includes('"addTarget"') && value.includes(`/consentApplications/${consentId}`));
    if (readsConsent) { readHeld = true; await readGate; }
    await route.continue();
  });
  try {
    await consentLink.click();
    await expect.poll(() => readHeld).toBe(true);
    const back = page.getByRole("link", { name: "Back to member", exact: true });
    const print = page.getByRole("button", { name: "Print / Save PDF", exact: true });
    await expect(back).toHaveAttribute("href", "/leader/members/TEST_member_cub_01");
    await expect(print).toBeVisible();
    await expect(print).toBeDisabled();
    const before = await back.boundingBox();
    expect(before).not.toBeNull();
    await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
    await page.mouse.down();
    releaseRead();
    await expect(print).toBeEnabled();
    const after = await back.boundingBox();
    expect(after).not.toBeNull();
    expect(after!.x).toBeCloseTo(before!.x, 1);
    expect(after!.y).toBeCloseTo(before!.y, 1);
    await page.mouse.up();
    await expect(page).toHaveURL(/\/leader\/members\/TEST_member_cub_01$/);
    await expect(page.getByRole("heading", { name: "Member Details" })).toBeVisible();
  } finally {
    releaseRead();
    await page.mouse.up();
    await page.unroute(listenChannel);
  }
});
