import { chromium } from './node_modules/playwright/index.mjs';
import { mkdirSync } from 'fs';

const BASE = 'http://localhost:3099';
const SHOTS = 'C:/tmp/verify';
try { mkdirSync(SHOTS, { recursive: true }); } catch(e) {}

const results = [];
const log = (icon, msg, detail='') => {
  const line = `${icon} ${msg}${detail ? ' → '+detail : ''}`;
  results.push(line);
  console.log(line);
};

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });

const shot = async (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
const force = async (loc) => loc.click({ force: true, timeout: 5000 }).catch(() => null);
const pause = (ms) => new Promise(r => setTimeout(r, ms));

// 1. LOGIN
await page.goto(`${BASE}/login`);
await page.waitForLoadState('networkidle');
log('✅', 'Login page loaded', await page.title());
await shot('01_login');
await page.locator('input[type="email"]').fill('livhuwaningwn@gmail.com');
await page.locator('input[type="password"]').fill('Admin@1234');
await force(page.locator('button[type="submit"]'));
await pause(4000);
const afterLogin = page.url();
log(afterLogin.includes('/manager') ? '✅' : '❌', 'Redirected to /manager', afterLogin);
await shot('02_manager');

// 2. NAVBAR LOGO + BRAND
const logoEl = await page.locator('div').filter({ hasText: /^MB$/ }).count();
log(logoEl > 0 ? '✅' : '❌', 'MB green logo square present');
const brandEl = await page.getByText('MB SmartTrack').count();
log(brandEl > 0 ? '✅' : '❌', 'MB SmartTrack brand text present');
await shot('03_navbar_logo');

// 3. OVERVIEW
const overviewStats = await page.getByText('Billable Time').count();
log(overviewStats > 0 ? '✅' : '❌', 'Overview stats visible');

// 4. BILLING DROPDOWN
await force(page.locator('button').filter({ hasText: /^Billing$/ }).first());
await pause(500);
await shot('04_billing_dropdown');
for (const item of ['Invoices','WIP Report','Debtors','Statements','Disbursements']) {
  const vis = await page.locator('button').filter({ hasText: item }).first().isVisible().catch(()=>false);
  log(vis ? '✅' : '❌', `Billing > ${item}`);
}

// Test Debtors buttons
await force(page.locator('button').filter({ hasText: 'Debtors' }).first());
await pause(2000);
await shot('05_debtors');
const woCount = await page.locator('button').filter({ hasText: 'W/O' }).count();
const cnCount = await page.locator('button').filter({ hasText: 'CN' }).count();
log(woCount > 0 ? '✅' : '⚠️', `Debtors W/O buttons`, `${woCount} found (0 = no outstanding invoices)`);
log(cnCount > 0 ? '✅' : '⚠️', `Debtors CN buttons`, `${cnCount} found`);

// 5. FINANCE: VAT Report
await force(page.locator('button').filter({ hasText: /^Finance$/ }).first());
await pause(400);
const vatBtn = page.locator('button').filter({ hasText: 'VAT Report' }).first();
log(await vatBtn.isVisible().catch(()=>false) ? '✅' : '❌', 'Finance > VAT Report in dropdown');
const intBtn = page.locator('button').filter({ hasText: 'Interest' }).first();
log(await intBtn.isVisible().catch(()=>false) ? '✅' : '❌', 'Finance > Interest in dropdown');
await force(vatBtn);
await pause(2000);
log(await page.getByText('VAT201').count() > 0 ? '✅' : '❌', 'VAT Report renders VAT201 heading');
await shot('06_vat_report');

// 6. PRACTICE GROUP
await force(page.locator('button').filter({ hasText: /^Practice$/ }).first());
await pause(400);
await shot('07_practice_dropdown');
for (const item of ['Matters','Clients','Undertakings','Communications']) {
  const vis = await page.locator('button').filter({ hasText: item }).first().isVisible().catch(()=>false);
  log(vis ? '✅' : '❌', `Practice > ${item}`);
}

// Matters tab
await force(page.locator('button').filter({ hasText: 'Matters' }).first());
await pause(2000);
log(await page.getByText('All Matters').count() > 0 ? '✅' : '❌', 'Matters tab renders');
await shot('08_matters');

// Undertakings
await force(page.locator('button').filter({ hasText: /^Practice$/ }).first());
await pause(300);
await force(page.locator('button').filter({ hasText: 'Undertakings' }).first());
await pause(2000);
log(await page.getByText('Undertakings Register').count() > 0 ? '✅' : '❌', 'Undertakings tab renders');
await shot('09_undertakings');

// Communications
await force(page.locator('button').filter({ hasText: /^Practice$/ }).first());
await pause(300);
await force(page.locator('button').filter({ hasText: 'Communications' }).first());
await pause(2000);
log(await page.getByText('Client Communications').count() > 0 ? '✅' : '❌', 'Communications tab renders');
await shot('10_communications');

// 7. HISTORY TAB
await force(page.locator('button').filter({ hasText: /^Analytics$/ }).first());
await pause(400);
await force(page.locator('button').filter({ hasText: 'History' }).first());
await pause(3000);
log(await page.getByText('Firm History').count() > 0 ? '✅' : '❌', 'History tab renders');
const monthCount = await page.locator('text=January').count();
log(monthCount > 0 ? '✅' : '❌', 'History shows month cards', `January found: ${monthCount}`);
await shot('11_history');

// 8. ADMIN GROUP
await force(page.locator('button').filter({ hasText: /^Admin$/ }).first());
await pause(400);

// Audit Log
await force(page.locator('button').filter({ hasText: 'Audit Log' }).first());
await pause(2000);
log(await page.getByText('Audit Trail').count() > 0 ? '✅' : '❌', 'Audit Log tab renders');
await shot('12_audit_log');

// Settings inline
await force(page.locator('button').filter({ hasText: /^Admin$/ }).first());
await pause(400);
await force(page.locator('button').filter({ hasText: 'Settings' }).first());
await pause(2000);
const onManager = page.url().includes('/manager');
log(onManager ? '✅' : '❌', 'Settings stays on /manager', page.url());
log(await page.getByText('Firm Settings').count() > 0 ? '✅' : '❌', 'Settings shows inline content');
await shot('13_settings');

// 9. MOBILE
await page.setViewportSize({ width: 390, height: 844 });
await pause(500);
await shot('14_mobile');
const burgerBtn = page.locator('button[aria-label="Menu"]');
const burgerVis = await burgerBtn.isVisible().catch(()=>false);
log(burgerVis ? '✅' : '❌', 'Hamburger menu button visible on mobile');
if (burgerVis) {
  await force(burgerBtn);
  await pause(600);
  await shot('15_mobile_menu_open');
  const mobileOverview = await page.getByText('Overview').count();
  log(mobileOverview > 0 ? '✅' : '❌', 'Mobile menu shows nav items');
}

await browser.close();

const p = results.filter(r=>r.startsWith('✅')).length;
const f = results.filter(r=>r.startsWith('❌')).length;
const w = results.filter(r=>r.startsWith('⚠️')).length;
console.log('\n══════════════════════════════');
console.log(`${p} passed  ${f} failed  ${w} warnings`);
console.log(`Screenshots saved to ${SHOTS}/`);
