import { defineConfig, devices } from "@playwright/test"

const useDevServer = process.env.PLAYWRIGHT_DEV_SERVER === "true"
const skipProductionBuild = process.env.PLAYWRIGHT_SKIP_BUILD === "true"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  timeout: 60000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "on",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: useDevServer
      ? "pnpm dev"
      : skipProductionBuild
        ? "pnpm start"
        : "pnpm build && pnpm start",
    env: useDevServer
      ? { NEXT_DIST_DIR: ".next-e2e", DISABLE_PWA: "true" }
      : { DISABLE_PWA: "true" },
    url: "http://localhost:3000/canvas",
    reuseExistingServer: false,
    timeout: useDevServer ? 30_000 : 180_000,
  },
})
