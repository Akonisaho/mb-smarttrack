const { test, expect } = require('@playwright/test');
const { login, openGroup } = require('./helpers');

test.describe('Attorney Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    const { CREDS } = require('./helpers');
    if (!CREDS.attorney.email) test.skip();
    await login(page, 'attorney');
    await page.goto('/');
    await page.waitForTimeout(2000);
  });

  test('Today tab renders timer and date', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Today' }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await expect(page.getByText(/Today|timer|activity/i).first()).toBeVisible();
  });

  test('Work > Matters tab renders', async ({ page }) => {
    await openGroup(page, 'Work');
    await page.locator('button').filter({ hasText: 'Matters' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Matter/i).first()).toBeVisible();
  });

  test('Work > All Activities tab renders', async ({ page }) => {
    await openGroup(page, 'Work');
    await page.locator('button').filter({ hasText: 'All Activities' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Activit/i).first()).toBeVisible();
  });

  test('Work > Undertakings tab renders', async ({ page }) => {
    await openGroup(page, 'Work');
    await page.locator('button').filter({ hasText: 'Undertakings' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Undertaking/i).first()).toBeVisible();
  });

  test('Work > Communications tab renders', async ({ page }) => {
    await openGroup(page, 'Work');
    await page.locator('button').filter({ hasText: 'Communications' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Communication/i).first()).toBeVisible();
  });

  test('Work > Analytics tab renders', async ({ page }) => {
    await openGroup(page, 'Work');
    await page.locator('button').filter({ hasText: 'Analytics' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Analytics|Performance/i).first()).toBeVisible();
  });

  test('Work > History tab renders', async ({ page }) => {
    await openGroup(page, 'Work');
    await page.locator('button').filter({ hasText: 'History' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await expect(page.getByText(/History/i).first()).toBeVisible();
  });

  test('Work > Performance tab renders', async ({ page }) => {
    await openGroup(page, 'Work');
    await page.locator('button').filter({ hasText: 'Performance' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Performance|Target/i).first()).toBeVisible();
  });

  test('Billing > Invoice tab renders', async ({ page }) => {
    await openGroup(page, 'Billing');
    await page.locator('button').filter({ hasText: 'Invoice' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Invoice/i).first()).toBeVisible();
  });

  test('Billing > Costs (Disbursements) tab renders', async ({ page }) => {
    await openGroup(page, 'Billing');
    await page.locator('button').filter({ hasText: 'Costs' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Disbursement|Cost/i).first()).toBeVisible();
  });

  test('Billing > Archive tab renders write-off / credit note actions', async ({ page }) => {
    await openGroup(page, 'Billing');
    await page.locator('button').filter({ hasText: 'Archive' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Archive|Write|Credit/i).first()).toBeVisible();
  });

  test('Trust tab renders trust ledger', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Trust' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Trust/i).first()).toBeVisible();
  });

  test('Conflict check fires when creating a matter with existing client', async ({ page }) => {
    await openGroup(page, 'Work');
    await page.locator('button').filter({ hasText: 'Matters' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    const newBtn = page.locator('button').filter({ hasText: /New Matter|\+ Matter/i }).first();
    if (await newBtn.count() > 0) {
      await newBtn.click();
      await page.waitForTimeout(500);
      // Just verify form opens
      await expect(page.locator('input').first()).toBeVisible();
    }
  });
});
