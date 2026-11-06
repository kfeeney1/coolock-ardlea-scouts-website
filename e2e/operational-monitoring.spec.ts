import { expect, test } from "@playwright/test";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { loginAsLeader } from "./support/authentication-helpers";

const password = process.env.E2E_TEST_USER_PASSWORD;
const ids = ["monitoring-synthetic-zero", "monitoring-synthetic-stale", "monitoring-synthetic-wrong-environment"];

test("Super Admin distinguishes zero, stale and mismatched monitoring evidence", async ({ page }) => {
  test.skip(!password || !process.env.FIRESTORE_EMULATOR_HOST, "Synthetic emulator and canonical credentials required.");
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "demo-coolock-ardlea-scouts";
  if (!projectId.startsWith("demo-") || !/^(127\.0\.0\.1|localhost):/.test(process.env.FIRESTORE_EMULATOR_HOST!)) throw new Error("Monitoring fixtures are emulator-only.");
  const db = getFirestore(getApps()[0] || initializeApp({ projectId }));
  const common = { service: "Synthetic quota", metric: "daily requests", environment: "TEST", state: "Healthy", observedAt: new Date().toISOString(), maxAgeHours: 26, source: "Synthetic emulator fixture", sourceType: "authoritative-live", current: 0, limit: 100, limitSource: "provider-retrieved" };
  try {
    await db.collection("operationalMonitoring").doc(ids[0]).set(common);
    await db.collection("operationalMonitoring").doc(ids[1]).set({ ...common, service: "Stale fixture", observedAt: "2020-01-01T00:00:00Z" });
    await db.collection("operationalMonitoring").doc(ids[2]).set({ ...common, service: "Wrong environment fixture", environment: "PRODUCTION" });
    await loginAsLeader(page, { email: process.env.E2E_SUPER_ADMIN_EMAIL || "superadmin@example.com", password: password! });
    await page.goto("/leader/system");
    await expect(page.getByRole("heading", { name: "Synthetic quota: Healthy", exact: true })).toBeVisible();
    await expect(page.getByText("Usage: 0 / 100", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Stale fixture: Unavailable", exact: true })).toBeVisible();
    await expect(page.getByText("Data availability: stale", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Wrong environment fixture: Unavailable", exact: true })).toBeVisible();
    await expect(page.getByText(/Coverage is partial/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  } finally {
    await Promise.all(ids.map(id => db.collection("operationalMonitoring").doc(id).delete()));
  }
});
