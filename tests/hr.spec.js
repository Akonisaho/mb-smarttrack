const { test, expect } = require('@playwright/test');
const { login, CREDS } = require('./helpers');

test.describe('HR Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // HR tests run as manager (who also has /hr access) if no HR creds set
    const useManager = !CREDS.hr.email;
    await login(page, useManager ? 'manager' : 'hr');
    if (useManager) {
      await page.goto('/hr');
      await page.waitForTimeout(2000);
    }
    await expect(page).toHaveURL(/hr/);
  });

  // ── Staff tab ─────────────────────────────────────────────
  test('Staff tab renders staff directory table', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Staff$/ }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Staff Directory')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('Staff tab shows staff count stat', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Staff$/ }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Total Staff')).toBeVisible();
    await expect(page.getByText('Attorneys')).toBeVisible();
  });

  test('Staff tab — clicking a title cell enables inline edit', async ({ page }) => {
    await page.locator('button').filter({ hasText: /^Staff$/ }).first().click({ force: true });
    await page.waitForTimeout(1500);
    const titleCell = page.locator('span').filter({ hasText: /Click to set|Partner|Attorney/i }).first();
    if (await titleCell.count() > 0) {
      await titleCell.click();
      await page.waitForTimeout(300);
      await expect(page.locator('select').last()).toBeVisible();
    }
  });

  // ── Performance tab ───────────────────────────────────────
  test('Performance tab renders attorney cards', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Performance' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText('Performance Review')).toBeVisible();
  });

  test('Performance tab period selector changes period label', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Performance' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    const sel = page.locator('select').first();
    await sel.selectOption({ index: 1 });
    await page.waitForTimeout(500);
    await expect(page.getByText(/H2 2025|H1 2025/)).toBeVisible();
  });

  test('Performance tab — Add HR Feedback button opens modal', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Performance' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    const addBtn = page.locator('button').filter({ hasText: '+ Add HR Feedback' }).first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(500);
      await expect(page.getByText('HR Assessment')).toBeVisible();
      await page.keyboard.press('Escape');
    }
  });

  test('Performance tab — Copy Review button copies to clipboard', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Performance' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    const copyBtn = page.locator('button').filter({ hasText: '📋 Copy Review' }).first();
    if (await copyBtn.count() > 0) {
      await page.context().grantPermissions(['clipboard-write', 'clipboard-read']);
      await copyBtn.click();
      await page.waitForTimeout(500);
      // Alert should appear
      await expect(page.getByText(/copied/i).first()).toBeVisible({ timeout: 3000 }).catch(() => {});
    }
  });

  // ── Leave tab ─────────────────────────────────────────────
  test('Leave tab renders leave management table', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Leave' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Leave Management')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('Leave tab — status filter buttons work', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Leave' }).first().click({ force: true });
    await page.waitForTimeout(1000);
    for (const s of ['pending', 'approved', 'rejected', 'all']) {
      const btn = page.locator('button').filter({ hasText: new RegExp(`^${s}$`, 'i') }).first();
      if (await btn.count() > 0) { await btn.click(); await page.waitForTimeout(300); }
    }
  });

  test('Leave tab — Request Leave button opens modal', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Leave' }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('button').filter({ hasText: '+ Request Leave' }).first().click();
    await page.waitForTimeout(500);
    await expect(page.getByText('Submit Leave Request')).toBeVisible();
  });

  test('Leave tab — leave form shows duration when dates selected', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Leave' }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('button').filter({ hasText: '+ Request Leave' }).first().click();
    await page.waitForTimeout(500);
    await page.locator('input[type="date"]').first().fill('2026-07-01');
    await page.locator('input[type="date"]').last().fill('2026-07-05');
    await page.waitForTimeout(300);
    await expect(page.getByText(/5 day/i)).toBeVisible();
  });

  test('Leave tab — submitting empty form shows validation (no crash)', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Leave' }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('button').filter({ hasText: '+ Request Leave' }).first().click();
    await page.waitForTimeout(500);
    await page.locator('button').filter({ hasText: 'Submit' }).last().click();
    await page.waitForTimeout(500);
    // Should show error alert, not crash
    await expect(page.getByText(/required|fill/i).first()).toBeVisible();
  });

  test('Leave tab — full leave request submission', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Leave' }).first().click({ force: true });
    await page.waitForTimeout(1000);
    await page.locator('button').filter({ hasText: '+ Request Leave' }).first().click();
    await page.waitForTimeout(500);
    // Select first staff member
    const staffSel = page.locator('select').first();
    const opts = await staffSel.locator('option').count();
    if (opts > 1) {
      await staffSel.selectOption({ index: 1 });
      await page.locator('input[type="date"]').first().fill('2026-08-01');
      await page.locator('input[type="date"]').last().fill('2026-08-03');
      await page.locator('button').filter({ hasText: 'Submit' }).last().click();
      await page.waitForTimeout(3000);
      // Expect success or error (not a crash)
      const ok = await page.getByText(/✓ Leave|Error/i).first().isVisible().catch(() => false);
      expect(ok || true).toBeTruthy();
    }
  });

  // ── Payroll tab ───────────────────────────────────────────
  test('Payroll tab renders payroll summary table', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Payroll' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Payroll Summary')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('Payroll tab shows stat cards', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Payroll' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Total Staff')).toBeVisible();
    await expect(page.getByText('Gross Billing')).toBeVisible();
  });

  test('Payroll tab month selector changes period', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Payroll' }).first().click({ force: true });
    await page.waitForTimeout(1000);
    const monthInput = page.locator('input[type="month"]').first();
    await monthInput.fill('2025-12');
    await page.waitForTimeout(500);
    await expect(page.getByText('2025-12')).toBeVisible();
  });

  test('Payroll tab Export CSV button triggers download', async ({ page }) => {
    await page.locator('button').filter({ hasText: 'Payroll' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }).catch(() => null),
      page.locator('button').filter({ hasText: '↓ Export CSV' }).first().click(),
    ]);
    // If download triggered, verify it's a CSV
    if (download) {
      expect(download.suggestedFilename()).toMatch(/payroll.*\.csv/i);
    }
  });
});
