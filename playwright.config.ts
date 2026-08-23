import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 1,
  use: {
    baseURL: "http://127.0.0.1:7007",
    channel: "chrome",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm dev --host 127.0.0.1 --port 7007",
    url: "http://127.0.0.1:7007",
    reuseExistingServer: true,
  },
});
