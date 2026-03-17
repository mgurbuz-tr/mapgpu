import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: process.env['CI'] ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            // Enable WebGPU in headless mode
            '--enable-unsafe-webgpu',
            '--enable-features=Vulkan',
            '--use-angle=swiftshader',
            '--use-gl=angle',
          ],
        },
      },
    },
  ],

  // Start vite dev server before running tests
  webServer: {
    command: 'pnpm --filter @mapgpu/examples dev --port 5173',
    port: 5173,
    reuseExistingServer: !process.env['CI'],
    timeout: 30_000,
    cwd: '../../',
  },
});
