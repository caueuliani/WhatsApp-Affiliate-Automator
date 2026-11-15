import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.mjs",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["junit", { outputFile: "e2e-results/junit.xml" }]] : "list",
  outputDir: "e2e-results/artifacts",
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "bunx vite --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/e2e/fixture.html",
    timeout: 60_000,
    reuseExistingServer: !process.env.CI,
  },
});
