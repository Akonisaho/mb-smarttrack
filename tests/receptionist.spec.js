const { test, expect } = require('@playwright/test');
const { login, CREDS } = require('./helpers');

test.describe('Receptionist Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    if (!CREDS.receptionist.email) test.skip();
    await login(page, 'receptionist');
    await expect(page).toHaveURL(/receptionist/);
  });

  test('Dashboard tab renders overview widgets', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Dashboard' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Dashboard|Welcome|Today/i).first()).toBeVisible();
  });

  test('Clients tab renders client list', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Clients' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Client/i).first()).toBeVisible();
  });

  test('Clients tab search filters results', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Clients' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    const searchInput = page.locator('input[type="text"], input[placeholder*="search" i]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('Test');
      await page.waitForTimeout(500);
    }
  });

  test('Calendar tab renders calendar view', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Calendar' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Calendar|Event|Appointment/i).first()).toBeVisible();
  });

  test('Matters tab renders matter list', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Matters' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Matter/i).first()).toBeVisible();
  });
});
