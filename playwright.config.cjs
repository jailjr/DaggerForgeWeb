const { defineConfig, devices } = require('@playwright/test');
const browserPath = process.platform === 'win32' ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' : undefined;

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 30000,
  fullyParallel: false,
  reporter: process.env.CI ? [['line'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: browserPath ? { executablePath: browserPath } : undefined },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }, { name: 'mobile', use: { ...devices['Pixel 5'] } }],
  webServer: [
    { command: 'node server/index.js', url: 'http://127.0.0.1:8787/health', reuseExistingServer: !process.env.CI, env: { PORT: '8787', NODE_ENV: 'test', SERVE_STATIC: '0', ENABLE_BACKUPS: '0' } },
    { command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
  ],
});
