const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './tests',
  /* テストスイート全体の実行前に一度だけ呼び出されるセットアップ処理 */
  globalSetup: require.resolve('./tests/global-setup.js'),
  /* タイムアウト設定 */
  timeout: 30 * 1000,
  expect: {
    timeout: 5000
  },
  /* 並列実行設定 */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    /* Base URL: Firebase Hosting エミュレータのデフォルトポート */
    baseURL: 'http://127.0.0.1:8080',
    trace: 'on-first-retry',
    // ヘッドレスモードで実行
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // テスト初期段階は Chromium のみで高速に回し、後日必要に応じて Firefox/Webkit を有効化
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],
});
