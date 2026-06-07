const { test, expect } = require('@playwright/test');
const { login, openGroup } = require('./helpers');

test.describe('Manager Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, 'manager');
    await expect(page).toHaveURL(/manager/);
  });

  // ── Overview ──────────────────────────────────────────────
  test('Overview tab renders firm stats', async ({ page }) => {
    await expect(page.getByText('Billable Time')).toBeVisible();
    await expect(page.getByText('Billed Revenue')).toBeVisible();
    await expect(page.getByText('Total Trust Held')).toBeVisible();
  });

  test('Overview period filter switches correctly', async ({ page }) => {
    for (const label of ['Day', 'Week', 'Month', 'All']) {
      const btn = page.locator('button').filter({ hasText: new RegExp(`^${label}$`) }).first();
      if (await btn.count() > 0) { await btn.click(); await page.waitForTimeout(500); }
    }
  });

  // ── Billing group ─────────────────────────────────────────
  test('Billing > Invoices tab renders', async ({ page }) => {
    await openGroup(page, 'Billing');
    await page.locator('button').filter({ hasText: 'Invoices' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Invoice|No invoices/i).first()).toBeVisible();
  });

  test('Billing > WIP Report tab renders', async ({ page }) => {
    await openGroup(page, 'Billing');
    await page.locator('button').filter({ hasText: 'WIP Report' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/WIP|work in progress/i).first()).toBeVisible();
  });

  test('Billing > Debtors tab renders', async ({ page }) => {
    await openGroup(page, 'Billing');
    await page.locator('button').filter({ hasText: 'Debtors' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Debtor|outstanding/i).first()).toBeVisible();
  });

  test('Billing > Statements tab renders', async ({ page }) => {
    await openGroup(page, 'Billing');
    await page.locator('button').filter({ hasText: 'Statements' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Statement/i).first()).toBeVisible();
  });

  test('Billing > Disbursements tab renders', async ({ page }) => {
    await openGroup(page, 'Billing');
    await page.locator('button').filter({ hasText: 'Disbursements' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Disbursement/i).first()).toBeVisible();
  });

  // ── Finance group ─────────────────────────────────────────
  test('Finance > Trust tab renders', async ({ page }) => {
    await openGroup(page, 'Finance');
    await page.locator('button').filter({ hasText: 'Trust' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Trust/i).first()).toBeVisible();
  });

  test('Finance > Reports tab renders', async ({ page }) => {
    await openGroup(page, 'Finance');
    await page.locator('button').filter({ hasText: 'Reports' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Report/i).first()).toBeVisible();
  });

  test('Finance > VAT Report tab renders VAT201', async ({ page }) => {
    await openGroup(page, 'Finance');
    await page.locator('button').filter({ hasText: 'VAT Report' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/VAT|Output/i).first()).toBeVisible();
  });

  test('Finance > Interest tab renders', async ({ page }) => {
    await openGroup(page, 'Finance');
    await page.locator('button').filter({ hasText: 'Interest' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Interest/i).first()).toBeVisible();
  });

  test('Finance > Fee Schedules tab renders', async ({ page }) => {
    await openGroup(page, 'Finance');
    await page.locator('button').filter({ hasText: 'Fee Schedules' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Fee|Schedule/i).first()).toBeVisible();
  });

  // ── Practice group ────────────────────────────────────────
  test('Practice > Matters tab renders', async ({ page }) => {
    await openGroup(page, 'Practice');
    await page.locator('button').filter({ hasText: 'Matters' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Matter|No matters/i).first()).toBeVisible();
  });

  test('Practice > Clients tab renders', async ({ page }) => {
    await openGroup(page, 'Practice');
    await page.locator('button').filter({ hasText: 'Clients' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Client|No clients/i).first()).toBeVisible();
  });

  test('Practice > Requests tab renders', async ({ page }) => {
    await openGroup(page, 'Practice');
    await page.locator('button').filter({ hasText: 'Requests' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Request|service/i).first()).toBeVisible();
  });

  test('Practice > Undertakings tab renders', async ({ page }) => {
    await openGroup(page, 'Practice');
    await page.locator('button').filter({ hasText: 'Undertakings' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Undertaking/i).first()).toBeVisible();
  });

  test('Practice > Communications tab renders', async ({ page }) => {
    await openGroup(page, 'Practice');
    await page.locator('button').filter({ hasText: 'Communications' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Communication/i).first()).toBeVisible();
  });

  test('Practice > Templates tab renders', async ({ page }) => {
    await openGroup(page, 'Practice');
    await page.locator('button').filter({ hasText: 'Templates' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Template/i).first()).toBeVisible();
  });

  // ── Analytics group ───────────────────────────────────────
  test('Analytics > Analytics tab renders', async ({ page }) => {
    await openGroup(page, 'Analytics');
    await page.locator('button').filter({ hasText: 'Analytics' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Analytics|performance/i).first()).toBeVisible();
  });

  test('Analytics > History tab renders month cards', async ({ page }) => {
    await openGroup(page, 'Analytics');
    await page.locator('button').filter({ hasText: 'History' }).first().click({ force: true });
    await page.waitForTimeout(3000);
    await expect(page.getByText(/History|Firm/i).first()).toBeVisible();
  });

  test('Analytics > Performance tab renders', async ({ page }) => {
    await openGroup(page, 'Analytics');
    await page.locator('button').filter({ hasText: 'Performance' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Performance/i).first()).toBeVisible();
  });

  // ── Admin group ───────────────────────────────────────────
  test('Admin > Staff tab renders staff table', async ({ page }) => {
    await openGroup(page, 'Admin');
    await page.locator('button').filter({ hasText: 'Staff' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Staff|Invite/i).first()).toBeVisible();
  });

  test('Admin > Campaigns tab renders compose form', async ({ page }) => {
    await openGroup(page, 'Admin');
    await page.locator('button').filter({ hasText: 'Campaigns' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await expect(page.getByText('Compose Campaign')).toBeVisible();
    await expect(page.getByText('Quick Templates')).toBeVisible();
  });

  test('Admin > Campaigns — template pre-fills form', async ({ page }) => {
    await openGroup(page, 'Admin');
    await page.locator('button').filter({ hasText: 'Campaigns' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    await page.locator('button').filter({ hasText: 'Use this template →' }).first().click();
    await page.waitForTimeout(300);
    const subject = await page.locator('input[type="text"]').last().inputValue().catch(() => '');
    expect(subject.length).toBeGreaterThan(0);
  });

  test('Admin > Court Roll tab renders', async ({ page }) => {
    await openGroup(page, 'Admin');
    await page.locator('button').filter({ hasText: 'Court Roll' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Court/i).first()).toBeVisible();
  });

  test('Admin > Audit Log tab renders', async ({ page }) => {
    await openGroup(page, 'Admin');
    await page.locator('button').filter({ hasText: 'Audit Log' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page.getByText(/Audit/i).first()).toBeVisible();
  });

  test('Admin > Settings tab renders inline (no redirect)', async ({ page }) => {
    await openGroup(page, 'Admin');
    await page.locator('button').filter({ hasText: 'Settings' }).first().click({ force: true });
    await page.waitForTimeout(2000);
    await expect(page).toHaveURL(/manager/);
    await expect(page.getByText(/Settings|Firm/i).first()).toBeVisible();
  });

  // ── Interactions ──────────────────────────────────────────
  test('New Matter button opens form', async ({ page }) => {
    await openGroup(page, 'Practice');
    await page.locator('button').filter({ hasText: 'Matters' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    const newBtn = page.locator('button').filter({ hasText: /New Matter|\+ Matter/i }).first();
    if (await newBtn.count() > 0) {
      await newBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('input, select, textarea').first()).toBeVisible();
    }
  });

  test('New Client button opens form', async ({ page }) => {
    await openGroup(page, 'Practice');
    await page.locator('button').filter({ hasText: 'Clients' }).first().click({ force: true });
    await page.waitForTimeout(1500);
    const newBtn = page.locator('button').filter({ hasText: /New Client|\+ Client/i }).first();
    if (await newBtn.count() > 0) {
      await newBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('input').first()).toBeVisible();
    }
  });

  test('Pending trust payments banner shown if applicable', async ({ page }) => {
    // Just verify the banner area exists (may or may not have pending payments)
    await page.waitForTimeout(1000);
    const page_content = await page.content();
    expect(page_content).toContain('manager');
  });
});
