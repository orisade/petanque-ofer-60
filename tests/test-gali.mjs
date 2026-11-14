import { chromium } from 'playwright';
const errors = [];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5173');
await page.click('#start-btn');
await page.waitForTimeout(1500);
// pick Gali's turn view: move camera close to her for a review shot
await page.evaluate(() => { const g = window.__game; g.current = 1; g.currentPlayer = g.teams[1].players.find(p => p.key === 'gali'); });
await page.waitForTimeout(300);
await page.screenshot({ path: 'shot-gali.png' });
console.log('ERRORS:', errors.length ? errors : 'none');
await browser.close();
