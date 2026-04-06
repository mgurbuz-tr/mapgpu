import { test, expect } from '@playwright/test';

test.describe('Map Interaction', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/basic-map.html');
    await page.waitForLoadState('networkidle');
    // Wait for canvas to be created
    await page.locator('#map-container canvas').waitFor({ timeout: 5000 });
  });

  test('mouse wheel zoom updates view', async ({ page }) => {
    const log = page.locator('#log');

    // Wait for initial log
    await expect(log.locator('.entry')).not.toHaveCount(0, { timeout: 5000 });

    const container = page.locator('#map-container');
    const box = await container.boundingBox();
    if (!box) return;

    // Scroll wheel on the map center
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300); // scroll up = zoom in

    // Wait for view-change event in log
    await page.waitForTimeout(500);

    const logText = await log.textContent();
    expect(logText).toContain('View changed');
  });

  test('keyboard zoom works when map is focused', async ({ page }) => {
    const container = page.locator('#map-container');

    // Click to focus the container
    await container.click();

    const log = page.locator('#log');
    const initialEntryCount = await log.locator('.entry').count();

    // Press + to zoom in
    await page.keyboard.press('+');
    await page.waitForTimeout(300);

    const logText = await log.textContent();
    expect(logText).toContain('View changed');
  });

  test('arrow keys pan the map', async ({ page }) => {
    const container = page.locator('#map-container');

    // Click to focus
    await container.click();
    await page.waitForTimeout(200);

    // Press arrow right
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(300);

    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('View changed');
  });

  test('drag pan moves the map', async ({ page }) => {
    const container = page.locator('#map-container');
    const box = await container.boundingBox();
    if (!box) return;

    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;

    // Drag from center to 100px right
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 100, cy, { steps: 5 });
    await page.mouse.up();

    await page.waitForTimeout(300);

    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('View changed');
  });

  test('go to buttons navigate and log', async ({ page }) => {
    const log = page.locator('#log');

    await page.locator('#btn-ankara').click();
    await page.waitForTimeout(1000);

    const logText = await log.textContent();
    expect(logText).toContain('Navigating to Ankara');
  });

  test('click on map shows coordinates', async ({ page }) => {
    const container = page.locator('#map-container');
    const box = await container.boundingBox();
    if (!box) return;

    // Click on the map
    await container.click({
      position: { x: box.width / 2, y: box.height / 2 },
    });

    await page.waitForTimeout(300);

    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('Click at pixel');
  });
});
