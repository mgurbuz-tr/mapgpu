import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

const GPU_VALIDATION_PATTERNS = [
  /GPU VALIDATION ERROR/i,
  /Invalid CommandBuffer/i,
  /Attachment state .* is not compatible/i,
];

async function collect3DRenderErrors(page: Page, url: string): Promise<{
  hasWebGPU: boolean;
  consoleErrors: string[];
  pageErrors: string[];
}> {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error' || GPU_VALIDATION_PATTERNS.some((pattern) => pattern.test(text))) {
      consoleErrors.push(`[console:${msg.type()}] ${text}`);
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(String(error));
  });

  await page.goto(url);
  const hasWebGPU = await page.evaluate(() => 'gpu' in navigator);
  await page.waitForLoadState('networkidle');
  if (hasWebGPU) {
    await page.locator('#map-container canvas').waitFor({ timeout: 10_000 });
    await page.waitForTimeout(1_500);
  }

  return { hasWebGPU, consoleErrors, pageErrors };
}

test.describe('3D Globe Rendering', () => {
  test('globe-view starts without WebGPU validation errors', async ({ page }) => {
    const { hasWebGPU, consoleErrors, pageErrors } = await collect3DRenderErrors(page, '/globe-view.html');
    test.skip(!hasWebGPU, 'WebGPU is not available in this browser');

    await expect(page).toHaveTitle('MapGPU — Globe View');
    await expect(page.locator('#map-container canvas')).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('helicopter-flight starts without WebGPU validation errors', async ({ page }) => {
    const { hasWebGPU, consoleErrors, pageErrors } = await collect3DRenderErrors(page, '/helicopter-flight.html');
    test.skip(!hasWebGPU, 'WebGPU is not available in this browser');

    await expect(page).toHaveTitle('MapGPU — Helicopter Flight');
    await expect(page.locator('#map-container canvas')).toBeVisible();
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});
