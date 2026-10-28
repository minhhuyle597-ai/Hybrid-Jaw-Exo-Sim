import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 15000 },
  outputDir: ".runtime/browser-results",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4174/Hybrid-Jaw-Exo-Sim/",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
  },
  webServer: {
    command:
      "npm run preview -- --port 4174 --strictPort --base=/Hybrid-Jaw-Exo-Sim/",
    url: "http://127.0.0.1:4174/Hybrid-Jaw-Exo-Sim/",
    reuseExistingServer: false,
  },
});
