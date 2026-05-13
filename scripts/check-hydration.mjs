import { chromium } from 'playwright';

const consoleEvents = [];
const pageErrors = [];

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on('console', (msg) => {
  consoleEvents.push({ type: msg.type(), text: msg.text() });
});
page.on('pageerror', (err) => {
  pageErrors.push(err.message);
});

try {
  await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
  const url1 = page.url();
  console.log('STEP1_URL', url1);

  if (/\/login(\?|$)/.test(url1)) {
    await page.fill('input[type="email"], input[name="email"]', 'owner@kahramana.test');
    await page.fill('input[type="password"], input[name="password"]', 'owner123');
    await Promise.all([
      page.waitForLoadState('networkidle', { timeout: 30000 }),
      page.click('button[type="submit"]'),
    ]);
    console.log('STEP2_URL', page.url());

    if (!/\/dashboard/.test(page.url())) {
      await page.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle', timeout: 30000 });
      console.log('STEP3_URL', page.url());
    }
  }

  await page.waitForTimeout(2000);

  const hasSidebar = await page.locator('aside, nav').count();
  console.log('NAV_COUNT', hasSidebar);

  const hydrationLines = consoleEvents.filter((e) =>
    /hydrat|mismatch|418|423|425|did not match/i.test(e.text),
  );
  const errorLines = consoleEvents.filter((e) => e.type === 'error');

  console.log('--- HYDRATION/MISMATCH LINES ---');
  hydrationLines.forEach((e) => console.log(`[${e.type}] ${e.text}`));
  console.log('--- OTHER ERROR LINES ---');
  errorLines
    .filter((e) => !hydrationLines.includes(e))
    .forEach((e) => console.log(`[${e.type}] ${e.text}`));
  console.log('--- PAGE ERRORS ---');
  pageErrors.forEach((m) => console.log(m));

  console.log('SUMMARY', JSON.stringify({
    finalUrl: page.url(),
    hydration: hydrationLines.length,
    errors: errorLines.length,
    pageErrors: pageErrors.length,
  }));
} catch (e) {
  console.log('FATAL', e.message);
} finally {
  await browser.close();
}
