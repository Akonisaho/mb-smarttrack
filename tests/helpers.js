// Shared helpers for all test specs

const CREDS = {
  manager:     { email: process.env.MGR_EMAIL     || 'livhuwaningwn@gmail.com', password: process.env.MGR_PASS     || 'Admin@1234' },
  attorney:    { email: process.env.ATT_EMAIL     || '', password: process.env.ATT_PASS     || '' },
  hr:          { email: process.env.HR_EMAIL      || '', password: process.env.HR_PASS      || '' },
  bookkeeper:  { email: process.env.BK_EMAIL      || '', password: process.env.BK_PASS      || '' },
  receptionist:{ email: process.env.REC_EMAIL     || '', password: process.env.REC_PASS     || '' },
};

async function login(page, role) {
  const { email, password } = CREDS[role];
  if (!email || !password) throw new Error(`No credentials configured for role: ${role}. Set ${role.toUpperCase()}_EMAIL and ${role.toUpperCase()}_PASS env vars.`);
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3500);
}

async function clickTab(page, tabId) {
  // Try nav button with matching id or label
  const btn = page.locator(`button`).filter({ hasText: new RegExp(`^${tabId}$`, 'i') }).first();
  if (await btn.count() > 0) { await btn.click({ force: true }); await page.waitForTimeout(1500); return; }
  // Fallback: click any button containing the text
  const btn2 = page.locator('button').filter({ hasText: tabId }).first();
  if (await btn2.count() > 0) { await btn2.click({ force: true }); await page.waitForTimeout(1500); }
}

async function openGroup(page, groupLabel) {
  const grp = page.locator('button').filter({ hasText: new RegExp(`^${groupLabel}$`, 'i') }).first();
  if (await grp.count() > 0) { await grp.click({ force: true }); await page.waitForTimeout(300); }
}

async function noConsoleErrors(page) {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  return () => errors.filter(e => !e.includes('Warning:') && !e.includes('ResizeObserver'));
}

module.exports = { login, clickTab, openGroup, CREDS };
