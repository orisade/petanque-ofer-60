import { chromium } from 'playwright';

const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto('http://localhost:5173');
await page.waitForSelector('text=Jouer', { timeout: 15000 });
await page.screenshot({ path: 'shot-start.png' });

await page.click('#start-btn');
await page.waitForSelector('text=cochonnet', { timeout: 10000 });
await page.waitForTimeout(800);
await page.screenshot({ path: 'shot-court.png' });

// throw the jack: aim mid-court, hold, release
await page.mouse.move(640, 420);
await page.mouse.down();
await page.waitForTimeout(600);
await page.mouse.up();
await page.waitForTimeout(3500);
await page.screenshot({ path: 'shot-after-jack.png' });

console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
await browser.close();
