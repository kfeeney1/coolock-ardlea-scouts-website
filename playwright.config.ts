import { defineConfig, devices } from "@playwright/test";

const webkitCriticalPath = /webkit-critical-path\.spec\.ts/;
const configuredWorkers = Number.parseInt(process.env.E2E_WORKERS || "1", 10);
const workers = Number.isFinite(configuredWorkers) && configuredWorkers > 0 ? configuredWorkers : 1;

export default defineConfig({
  testDir: "./e2e",
  // Most authenticated specs share one deterministic Firebase emulator dataset.
  // Keep the default serial across files too; developers can opt into more workers
  // for isolated/read-only work with E2E_WORKERS when they know it is safe.
  fullyParallel: false,
  workers,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  timeout: 45_000,
  expect: {
    timeout: 10_000
  },
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "playwright-report", open: "never" }]]
    : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "https://coolock-ardlea-scouts.web.app",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    { name: "chromium", testIgnore: webkitCriticalPath, use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", testIgnore: webkitCriticalPath, use: { ...devices["Pixel 7"] } },
    {
      name: "webkit-critical",
      testMatch: webkitCriticalPath,
      use: { ...devices["iPhone 15"] }
    }
  ]
});
