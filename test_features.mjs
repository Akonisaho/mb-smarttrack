import { chromium } from './node_modules/playwright/index.mjs';

const BASE = 'http://localhost:3099';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

// ── LOGIN ──────────────────────────────────────────────────
await page.goto(BASE + '/login');
await page.waitForLoadState('networkidle');
console.log('LOGIN page loaded:', await page.title());
await page.locator('input[type="email"]').fill('livhuwaningwn@gmail.com');
await page.locator('input[type="password"]').fill('Admin@1234');
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(4000);
console.log('After login URL:', page.url());
await page.screenshot({ path: 'C:/tmp/01_after_login.png', fullPage: false });

// ── NAVIGATE TO ATTORNEY DASHBOARD ─────────────────────────
// Manager role redirects to /manager - need to go to attorney
// Use the index page directly for attorney features
await page.goto(BASE + '/');
await page.waitForTimeout(3000);
console.log('Attorney dashboard URL:', page.url());
await page.screenshot({ path: 'C:/tmp/02_attorney.png' });

// ── TEST: MATTER NOTES ─────────────────────────────────────
// Click Matters in NavBar
const mattersBtn = page.locator('button, a').filter({ hasText: 'Matters' }).first();
if (await mattersBtn.count() > 0) {
  await mattersBtn.click();
  await page.waitForTimeout(2000);
  console.log('Clicked Matters tab');
  await page.screenshot({ path: 'C:/tmp/03_matters_tab.png' });

  // Look for Notes button on any matter card
  const notesBtn = page.locator('button').filter({ hasText: 'Notes' }).first();
  if (await notesBtn.count() > 0) {
    await notesBtn.click();
    await page.waitForTimeout(1000);
    console.log('MATTER NOTES: Notes button found and clicked');
    await page.screenshot({ path: 'C:/tmp/04_notes_open.png' });

    // Type a test note
    const textarea = page.locator('textarea[placeholder="Type your note..."]').first();
    if (await textarea.count() > 0) {
      await textarea.fill('Test note from automated verification');
      const saveBtn = page.locator('button').filter({ hasText: 'Save' }).first();
      await saveBtn.click();
      await page.waitForTimeout(2000);
      console.log('MATTER NOTES: Note saved');
      await page.screenshot({ path: 'C:/tmp/05_note_saved.png' });
    } else {
      console.log('MATTER NOTES WARNING: textarea not found');
    }
  } else {
    console.log('MATTER NOTES WARNING: No Notes button found — no matters exist yet');
  }
} else {
  console.log('WARNING: Matters nav item not found');
}

// ── TEST: ARCHIVE TAB (write-off, credit note, email) ───────
const workGroup = page.locator('button').filter({ hasText: 'Work' }).first();
if (await workGroup.count() > 0) {
  await workGroup.click();
  await page.waitForTimeout(500);
}
const billingGroup = page.locator('button').filter({ hasText: 'Billing' }).first();
if (await billingGroup.count() > 0) {
  await billingGroup.click();
  await page.waitForTimeout(500);
}
const archiveBtn = page.locator('button').filter({ hasText: 'Archive' }).first();
if (await archiveBtn.count() > 0) {
  await archiveBtn.click();
  await page.waitForTimeout(2000);
  console.log('Clicked Archive tab');
  await page.screenshot({ path: 'C:/tmp/06_archive_tab.png' });

  const writeOffBtn = page.locator('button').filter({ hasText: 'Write Off' }).first();
  const creditNoteBtn = page.locator('button').filter({ hasText: 'Credit Note' }).first();
  const emailBtn = page.locator('button').filter({ hasText: 'Email' }).first();

  console.log('WRITE OFF button visible:', await writeOffBtn.count() > 0);
  console.log('CREDIT NOTE button visible:', await creditNoteBtn.count() > 0);
  console.log('EMAIL button visible:', await emailBtn.count() > 0);

  if (await creditNoteBtn.count() > 0) {
    await creditNoteBtn.click();
    await page.waitForTimeout(1000);
    console.log('CREDIT NOTE: modal opened');
    await page.screenshot({ path: 'C:/tmp/07_credit_note_modal.png' });
    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
} else {
  console.log('Archive tab not found — no invoices saved yet');
}

// ── TEST: MANAGER DEBTORS ───────────────────────────────────
await page.goto(BASE + '/manager');
await page.waitForTimeout(3000);
console.log('Manager page URL:', page.url());

// Click Billing → Debtors
const billingGroupMgr = page.locator('button').filter({ hasText: 'Billing' }).first();
if (await billingGroupMgr.count() > 0) {
  await billingGroupMgr.click();
  await page.waitForTimeout(400);
  const debtorsBtn = page.locator('button').filter({ hasText: 'Debtors' }).first();
  if (await debtorsBtn.count() > 0) {
    await debtorsBtn.click();
    await page.waitForTimeout(2000);
    console.log('Manager Debtors tab loaded');
    await page.screenshot({ path: 'C:/tmp/08_manager_debtors.png' });

    const woBtn  = page.locator('button').filter({ hasText: 'W/O' }).first();
    const cnBtn  = page.locator('button').filter({ hasText: 'CN' }).first();
    const emBtn  = page.locator('button').filter({ hasText: '✉' }).first();
    console.log('Manager W/O button:', await woBtn.count() > 0);
    console.log('Manager CN button:', await cnBtn.count() > 0);
    console.log('Manager email button:', await emBtn.count() > 0);
  }
}

await page.screenshot({ path: 'C:/tmp/09_final.png' });
await browser.close();
console.log('DONE — screenshots in C:/tmp/');
