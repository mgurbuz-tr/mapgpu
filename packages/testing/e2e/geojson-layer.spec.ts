import { test, expect } from '@playwright/test';

test.describe('GeoJSON Layer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/geojson-layer.html');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/GeoJSON/);
  });

  test('log shows GeoJSON layer loaded with features', async ({ page }) => {
    const log = page.locator('#log');

    // Wait for log entries to appear
    await expect(log.locator('.entry')).not.toHaveCount(0, { timeout: 5000 });

    // Wait for the layer to finish loading
    await page.waitForTimeout(1000);

    const logText = await log.textContent();
    expect(logText).toContain('GeoJSONLayer added');
    expect(logText).toContain('GeoJSONLayer loaded');
    expect(logText).toContain('Istanbul');
  });

  test('query all features button returns results', async ({ page }) => {
    const log = page.locator('#log');

    // Wait for layer to load
    await page.waitForTimeout(1000);

    // Click query all
    await page.locator('#btn-query-all').click();

    // Wait for query results
    await page.waitForTimeout(500);

    const logText = await log.textContent();
    expect(logText).toContain('Query: All Features');
    expect(logText).toContain('10 feature(s)');
  });

  test('population query filters correctly', async ({ page }) => {
    await page.waitForTimeout(1000);

    await page.locator('#btn-query-pop').click();
    await page.waitForTimeout(500);

    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('population > 5M');
    // Istanbul (15.8M) and Ankara (5.7M) should match
    expect(logText).toContain('Istanbul');
    expect(logText).toContain('Ankara');
  });

  test('highlight button adds feature to graphics layer', async ({ page }) => {
    await page.waitForTimeout(1000);

    await page.locator('#btn-highlight').click();
    await page.waitForTimeout(1000);

    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('Highlighting Istanbul');
    expect(logText).toContain('Added to highlights layer');
  });

  test('clear button removes highlighted features', async ({ page }) => {
    await page.waitForTimeout(1000);

    // First highlight something
    await page.locator('#btn-highlight').click();
    await page.waitForTimeout(500);

    // Then clear
    await page.locator('#btn-clear').click();
    await page.waitForTimeout(300);

    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('Clearing highlights');
    expect(logText).toContain('Current count: 0');
  });
});
