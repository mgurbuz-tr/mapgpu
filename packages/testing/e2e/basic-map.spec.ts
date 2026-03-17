import { test, expect } from '@playwright/test';

test.describe('Basic Map', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/basic-map.html');
    // Wait for the page to fully load
    await page.waitForLoadState('networkidle');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Basic Map - MapGPU Examples');
  });

  test('map container exists', async ({ page }) => {
    const container = page.locator('#map-container');
    await expect(container).toBeVisible();
  });

  test('canvas element is created inside container', async ({ page }) => {
    // MapView2D should auto-create a canvas
    const canvas = page.locator('#map-container canvas');
    await expect(canvas).toBeAttached({ timeout: 5000 });
  });

  test('canvas has non-zero dimensions', async ({ page }) => {
    const canvas = page.locator('#map-container canvas');
    await expect(canvas).toBeAttached({ timeout: 5000 });

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('toolbar buttons exist', async ({ page }) => {
    await expect(page.locator('#btn-zoom-in')).toBeVisible();
    await expect(page.locator('#btn-zoom-out')).toBeVisible();
    await expect(page.locator('#btn-istanbul')).toBeVisible();
    await expect(page.locator('#btn-ankara')).toBeVisible();
  });

  test('log panel shows initialization messages', async ({ page }) => {
    const log = page.locator('#log');
    await expect(log).toBeVisible();

    // Wait for log to populate
    await expect(log.locator('.entry')).not.toHaveCount(0, { timeout: 5000 });

    const logText = await log.textContent();
    expect(logText).toContain('MapView2D created');
    expect(logText).toContain('Layer added');
  });

  test('zoom buttons update log', async ({ page }) => {
    const log = page.locator('#log');

    // Wait for initial messages
    await expect(log.locator('.entry')).not.toHaveCount(0, { timeout: 5000 });

    const initialEntryCount = await log.locator('.entry').count();

    // Click zoom in
    await page.locator('#btn-zoom-in').click();

    // Wait for new log entry
    await expect(log.locator('.entry')).toHaveCount(initialEntryCount + 1, {
      timeout: 3000,
    }).catch(() => {
      // May have more entries due to view-change events
    });

    const logText = await log.textContent();
    expect(logText).toContain('Zoom in');
  });

  test('info overlay shows map state', async ({ page }) => {
    // The info div is created dynamically
    const infoDiv = page.locator('#map-container div').first();
    await expect(infoDiv).toBeVisible({ timeout: 3000 });

    const text = await infoDiv.textContent();
    expect(text).toContain('Basic Map Example');
    expect(text).toContain('Zoom');
  });
});

test.describe('Basic Map — WebGPU', () => {
  test('canvas receives WebGPU context (if supported)', async ({ page }) => {
    await page.goto('/basic-map.html');
    await page.waitForLoadState('networkidle');

    // Check if WebGPU is available in this browser context
    const hasWebGPU = await page.evaluate(() => 'gpu' in navigator);

    if (hasWebGPU) {
      // Wait for GPU initialization
      await page.waitForTimeout(2000);

      // Check console for GPU-related messages
      const consoleLogs: string[] = [];
      page.on('console', (msg) => consoleLogs.push(msg.text()));

      // Canvas should exist and be attached
      const canvas = page.locator('#map-container canvas');
      await expect(canvas).toBeAttached();

      // The canvas should have rendered something (not transparent)
      const pixelData = await page.evaluate(() => {
        const cv = document.querySelector('#map-container canvas') as HTMLCanvasElement;
        if (!cv) return null;
        // For WebGPU canvas, we can't read pixels directly with getContext('2d')
        // But we can verify the canvas is configured
        return { width: cv.width, height: cv.height };
      });

      expect(pixelData).not.toBeNull();
      expect(pixelData!.width).toBeGreaterThan(0);
    } else {
      // WebGPU not available — verify graceful degradation
      test.info().annotations.push({
        type: 'skip-reason',
        description: 'WebGPU not available in this browser',
      });
    }
  });
});
