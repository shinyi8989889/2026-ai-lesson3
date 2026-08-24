const { defineConfig, devices } = require('@playwright/test');

// 假設 http://localhost:3001 已由 `npm run start` 啟動，本設定刻意不使用
// webServer 選項另外啟動測試伺服器。
module.exports = defineConfig({
  testDir: './e2e',
  timeout: 120 * 1000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
