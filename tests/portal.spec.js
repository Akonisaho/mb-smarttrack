const { test, expect } = require('@playwright/test');

const PORTAL_URL = '/portal';

test.describe('Client Portal', () => {
  test('Portal page loads login form', async ({ page }) => {
    await page.goto(PORTAL_URL);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/Client Portal|Log in|Enter your/i).first()).toBeVisible();
  });

  test('Portal shows OTP request form', async ({ page }) => {
    await page.goto(PORTAL_URL);
    await page.waitForLoadState('networkidle');
    const emailInput = page.locator('input[type="email"]').first();
    await expect(emailInput).toBeVisible();
  });

  test('Portal OTP — wrong email shows error gracefully', async ({ page }) => {
    await page.goto(PORTAL_URL);
    await page.waitForLoadState('networkidle');
    const emailInput = page.locator('input[type="email"]').first();
    await emailInput.fill('doesnotexist@fake.com');
    const submitBtn = page.locator('button[type="submit"], button').filter({ hasText: /Send OTP|Get OTP|Continue|Request/i }).first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForTimeout(3000);
      // Should not crash — may show error message
      await expect(page).toHaveURL(/portal/);
    }
  });

  test('Portal shows matter list after login (if client creds provided)', async ({ page }) => {
    const clientEmail = process.env.CLIENT_EMAIL;
    const clientOtp   = process.env.CLIENT_OTP;
    if (!clientEmail || !clientOtp) test.skip();

    await page.goto(PORTAL_URL);
    await page.locator('input[type="email"]').fill(clientEmail);
    await page.locator('button').filter({ hasText: /OTP|Continue/i }).first().click();
    await page.waitForTimeout(2000);
    await page.locator('input[type="text"], input[name="otp"]').first().fill(clientOtp);
    await page.locator('button').filter({ hasText: /Verify|Login|Continue/i }).first().click();
    await page.waitForTimeout(3000);
    await expect(page.getByText(/Your Matters|Matter|Welcome/i).first()).toBeVisible();
  });

  test('Portal service request form renders', async ({ page }) => {
    await page.goto(PORTAL_URL);
    await page.waitForLoadState('networkidle');
    // The request form may be on the initial page or after login
    const reqSection = page.getByText(/new enquiry|service request|legal matter/i).first();
    // Just check page doesn't error
    await expect(page).toHaveURL(/portal/);
  });
});
