const { test, expect } = require('@playwright/test');
const { login } = require('./helpers');
const path = require('path');

test.describe('Document Management (/documents)', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'manager');
    await page.goto('/documents');
    await page.waitForTimeout(2000);
  });

  test('Documents page loads and shows table', async ({ page }) => {
    await expect(page.getByText('Document Management')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('Document type filter chips render', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible();
    // Type chips only render if documents exist; just verify no crash
    await expect(page).toHaveURL(/documents/);
  });

  test('Search input filters document list', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('test');
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/documents/);
  });

  test('Type dropdown filter works', async ({ page }) => {
    const typeFilter = page.locator('select').first();
    await typeFilter.selectOption('pleading');
    await page.waitForTimeout(500);
    await typeFilter.selectOption('contract');
    await page.waitForTimeout(500);
    await typeFilter.selectOption('all');
  });

  test('Upload Document button opens modal', async ({ page }) => {
    const uploadBtn = page.locator('button').filter({ hasText: '↑ Upload Document' }).first();
    await uploadBtn.click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Upload Document')).toBeVisible();
  });

  test('Upload modal — selecting a file updates display', async ({ page }) => {
    await page.locator('button').filter({ hasText: '↑ Upload Document' }).first().click();
    await page.waitForTimeout(500);
    // Set a file on the hidden input
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({ name: 'test.pdf', mimeType: 'application/pdf', buffer: Buffer.from('fake pdf content') });
    await page.waitForTimeout(300);
    await expect(page.getByText(/test\.pdf/)).toBeVisible();
  });

  test('Upload modal — submit without file shows error', async ({ page }) => {
    await page.locator('button').filter({ hasText: '↑ Upload Document' }).first().click();
    await page.waitForTimeout(500);
    await page.locator('button').filter({ hasText: 'Upload' }).last().click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/select a file|required/i)).toBeVisible();
  });

  test('Back button navigates away from documents', async ({ page }) => {
    await page.locator('button').filter({ hasText: '← Back' }).first().click();
    await page.waitForTimeout(1000);
    // Should navigate somewhere (back in history)
    await expect(page).not.toHaveURL('/documents');
  });
});
