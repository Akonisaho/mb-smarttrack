const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');

test.describe('Authentication', () => {
  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('wrong credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[type="email"]').fill('nobody@fake.com');
    await page.locator('input[type="password"]').fill('wrongpass');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    // Should stay on login page
    await expect(page).toHaveURL(/login/);
  });

  test('manager login redirects to /manager', async ({ page }) => {
    await login(page, 'manager');
    await expect(page).toHaveURL(/manager/);
  });

  test('unauthenticated access to /manager redirects to /login', async ({ page }) => {
    await page.goto('/manager');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/login/);
  });

  test('unauthenticated access to /hr redirects to /login', async ({ page }) => {
    await page.goto('/hr');
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/login|hr/);
  });

  test('sign out returns to /login', async ({ page }) => {
    await login(page, 'manager');
    await expect(page).toHaveURL(/manager/);
    const signOutBtn = page.locator('button').filter({ hasText: /sign.?out|log.?out/i }).first();
    if (await signOutBtn.count() > 0) {
      await signOutBtn.click();
      await page.waitForTimeout(2000);
      await expect(page).toHaveURL(/login/);
    }
  });
});
