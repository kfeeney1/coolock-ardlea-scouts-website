import { defineConfig, devices } from "@playwright/test";

const webkitCriticalPath = /webkit-critical-path\.spec\.ts/;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
