const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Offline & PWA', () => {
  test('manifest.json is accessible and valid', async ({ page }) => {
    const res = await page.request.get('/manifest.json');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.name).toBe('MB SmartTrack');
    expect(json.theme_color).toBe('#8DC63F');
    expect(json.display).toBe('standalone');
    expect(Array.isArray(json.icons)).toBeTruthy();
  });

  test('sw.js is accessible', async ({ page }) => {
    const res = await page.request.get('/sw.js');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toMatch(/javascript/);
  });

  test('offline banner hidden when online', async ({ page }) => {
    await login(page, 'manager');
    await expect(page).toHaveURL(/manager/);
    // When online, the "You are offline" bar must NOT be visible
    await expect(page.getByText('You are offline')).not.toBeVisible();
  });

  test('offline banner shown when network is offline', async ({ page }) => {
    await login(page, 'manager');
    await expect(page).toHaveURL(/manager/);
    // Simulate offline
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    await expect(page.getByText('You are offline')).toBeVisible({ timeout: 5000 });
    // Restore
    await page.context().setOffline(false);
    await page.waitForTimeout(1000);
    await expect(page.getByText('You are offline')).not.toBeVisible({ timeout: 5000 });
  });

  test('HTML document includes manifest link tag', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const manifest = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifest).toBe('/manifest.json');
  });

  test('HTML document includes theme-color meta', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    const themeColor = await page.locator('meta[name="theme-color"]').getAttribute('content');
    expect(themeColor).toBe('#8DC63F');
  });
});
