import { defineConfig, devices } from "@playwright/test"

// The tests run against the app from `pnpm dev`; they don't start one. When
// something else holds the default ports, point them at another copy with
// E2E_BASE_URL and E2E_API_URL (see e2e/env.ts).
export default defineConfig({
  testDir: "./e2e",
  // These specs share one app and database. Some choose existing quacks while
  // others delete them, so run the files one at a time.
  workers: 1,
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3050" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
})
