import { defineConfig, devices } from "@playwright/test";

const webkitCriticalPath = /webkit-critical-path\.spec\.ts/;
const stableEnvironmentSmoke = /test-environment-smoke\.spec\.ts/;
const runStableEnvironmentSmoke = process.env.E2E_STABLE_ENVIRONMENT_SMOKE === "true";
const configuredWorkers = Number.parseInt(process.env.E2E_WORKERS || "1", 10);
const workers = Number.isFinite(configuredWorkers) && configuredWorkers > 0 ? configuredWorkers : 1;

if (process.env.CI) {
  const required = runStableEnvironmentSmoke
    ? ["E2E_TEST_USER_PASSWORD"]
    : [
        "E2E_TEST_USER_PASSWORD",
        "E2E_LEADER_JOURNEY_SEEDED",
        "E2E_PARENT_EMAIL",
        "E2E_PARENT_LEADER_EMAIL",
        "E2E_LEADER_EMAIL",
        "E2E_MULTI_SECTION_LEADER_EMAIL",
        "E2E_MULTI_SECTION_LEADER_SECTIONS",
        "E2E_ADMIN_EMAIL",
        "E2E_SUPER_ADMIN_EMAIL",
        "E2E_MODERN_SUPER_ADMIN_EMAIL"
      ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) throw new Error(`Playwright CI configuration is incomplete: ${missing.join(", ")}`);
}

export default defineConfig({
  testDir: "./e2e",
  // Most authenticated specs share one deterministic Firebase emulator dataset.
  // Keep the default serial across files too; developers can opt into more workers
  // for isolated/read-only work with E2E_WORKERS when they know it is safe.
  fullyParallel: false,
  workers,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // Retries retain the trace from an intermittent failure, but a test that only
  // passes on retry is still a failed quality gate. This prevents green CI from
  // hiding timing and shared-state defects.
  failOnFlakyTests: Boolean(process.env.CI),
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "playwright-report", open: "never" }], ["./scripts/playwright-assurance-reporter.mjs"]]
    : "list",
  use: {
    // Fail away from production by default. Any non-local target must be supplied
    // explicitly by the dedicated TEST or manual PRODUCTION smoke workflow.
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "chromium",
      testIgnore: [webkitCriticalPath, ...(!runStableEnvironmentSmoke ? [stableEnvironmentSmoke] : [])],
      use: { ...devices["Desktop Chrome"] }
    },
    {
      name: "mobile-chromium",
      testIgnore: [webkitCriticalPath, ...(!runStableEnvironmentSmoke ? [stableEnvironmentSmoke] : [])],
      use: { ...devices["Pixel 7"] }
    },
    {
      name: "webkit-critical",
      testMatch: webkitCriticalPath,
      use: { ...devices["iPhone 15"] }
    }
  ]
});
