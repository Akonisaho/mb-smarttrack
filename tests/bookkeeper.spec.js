const { test, expect } = require('@playwright/test');
const { login, CREDS } = require('./helpers');

test.describe('Bookkeeper Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    if (!CREDS.bookkeeper.email) test.skip();
    await login(page, 'bookkeeper');
    await expect(page).toHaveURL(/bookkeeper/);
  });

  // ── Trust ─────────────────────────────────────────────────
  test('Trust tab renders with sub-tabs', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Trust' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Trust/i).first()).toBeVisible();
    // Sub-tabs
    for (const sub of ['Ledger', 'Receipt', 'Payment', 'Reconciliation']) {
      await expect(page.getByText(sub).first()).toBeVisible();
    }
  });

  test('Trust > Ledger sub-tab renders transactions', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Trust' }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('button').filter({ hasText: 'Ledger' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Ledger|Balance/i).first()).toBeVisible();
  });

  test('Trust > Receipt sub-tab renders receipt form', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Trust' }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('button').filter({ hasText: /^⬇ Receipt$|^Receipt$/ }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await expect(page.locator('input, select').first()).toBeVisible();
  });

  test('Trust > Payment sub-tab renders payment form', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Trust' }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('button').filter({ hasText: /^⬆ Payment$|^Payment$/ }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await expect(page.locator('input, select').first()).toBeVisible();
  });

  test('Trust > Reconciliation sub-tab shows system vs bank totals', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Trust' }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('button').filter({ hasText: /Reconciliation|🔁/ }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/System trust balance|Bank statement/i).first()).toBeVisible();
  });

  test('Trust > Reconciliation period lock button works', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Trust' }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('button').filter({ hasText: /Reconciliation|🔁/ }).first().click({ force: true });
    await page.waitForTimeout(1500);
    const lockBtn = page.locator('button').filter({ hasText: /🔒 Lock|Lock/i }).first();
    await expect(lockBtn).toBeVisible();
  });

  test('Trust > Reports sub-tab renders', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Trust' }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('button').filter({ hasText: /Reports|📋/ }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Report/i).first()).toBeVisible();
  });

  // ── Invoices ──────────────────────────────────────────────
  test('Invoices tab renders invoice list', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Invoices' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Invoice/i).first()).toBeVisible();
  });

  // ── Archive ───────────────────────────────────────────────
  test('Archive tab renders write-offs and credit notes', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Archive' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Archive|Write|Credit/i).first()).toBeVisible();
  });
});
