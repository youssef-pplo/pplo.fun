/// <reference path="./tests/config-runtime.d.ts" />
import { existsSync } from 'node:fs';
import { env } from 'node:process';
import { defineConfig } from '@playwright/test';

const localChrome = '/opt/google/chrome/chrome';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.ts',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(env.CI),
  retries: 0,
  timeout: 120_000,
  globalTimeout: 12 * 60_000,
  expect: { timeout: 12_000 },
  reporter: 'list',
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    headless: true,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: existsSync(localChrome) ? localChrome : undefined,
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    timeout: 30_000,
    reuseExistingServer: false,
  },
});
